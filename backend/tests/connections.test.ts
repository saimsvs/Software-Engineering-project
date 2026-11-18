import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { fakePrisma } from "./setup.js";

const app = createApp();

function tokenFor(userId: string): string {
  return jwt.sign({ userId, role: "user" }, env.jwtSecret);
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function seedUser(name: string, email: string) {
  return fakePrisma.seed.user({
    name,
    email,
    passwordHash: "irrelevant-for-connection-tests",
    emailVerified: true,
  });
}

function sendRequest(fromId: string, toId: string) {
  return request(app)
    .post("/api/connections")
    .set(auth(tokenFor(fromId)))
    .send({ userId: toId });
}

function search(meId: string, q = "") {
  return request(app)
    .get(`/api/users?q=${encodeURIComponent(q)}`)
    .set(auth(tokenFor(meId)));
}

let alice: ReturnType<typeof seedUser>;
let bob: ReturnType<typeof seedUser>;
let carol: ReturnType<typeof seedUser>;

beforeEach(() => {
  fakePrisma.reset();
  alice = seedUser("Alice Green", "alice@example.com");
  bob = seedUser("Bob Brown", "bob@example.com");
  carol = seedUser("Carol White", "carol@example.com");
});

describe("CONN discovery and search", () => {
  it("CONN-001 discover lists other users but never the caller or private fields", async () => {
    const res = await search(alice.id);

    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: any) => u.id);
    expect(ids).toEqual([carol.id, bob.id]); // newest first, no self
    expect(res.body.users[0]).toMatchObject({
      id: carol.id,
      name: "Carol White",
      relationship: "none",
    });
    expect(res.body.users[0].email).toBeUndefined();
    expect(res.body.users[0].passwordHash).toBeUndefined();
  });

  it("CONN-002 search matches names and emails case-insensitively", async () => {
    const byName = await search(alice.id, "bOb");
    expect(byName.body.users.map((u: any) => u.id)).toEqual([bob.id]);

    const byEmail = await search(alice.id, "CAROL@EXAMPLE");
    expect(byEmail.body.users.map((u: any) => u.id)).toEqual([carol.id]);

    const noMatch = await search(alice.id, "zzzz");
    expect(noMatch.body.users).toEqual([]);
  });

  it("CONN-003 search results show the relationship state", async () => {
    await sendRequest(alice.id, bob.id);

    const asAlice = await search(alice.id, "bob");
    expect(asAlice.body.users[0].relationship).toBe("request_sent");
    expect(typeof asAlice.body.users[0].connectionId).toBe("string");

    const asBob = await search(bob.id, "alice");
    expect(asBob.body.users[0].relationship).toBe("request_received");

    const connectionId = asAlice.body.users[0].connectionId;
    await request(app)
      .post(`/api/connections/${connectionId}/accept`)
      .set(auth(tokenFor(bob.id)));

    const afterAccept = await search(alice.id, "bob");
    expect(afterAccept.body.users[0].relationship).toBe("connected");
  });
});

describe("CONN sending requests", () => {
  it("CONN-004 sends a pending request and stores the pair canonically", async () => {
    const res = await sendRequest(alice.id, bob.id);

    expect(res.status).toBe(201);
    expect(res.body.connection.status).toBe("pending");
    expect(res.body.connection.requestedById).toBe(alice.id);

    const rows = fakePrisma._connections();
    expect(rows).toHaveLength(1);
    // userAId < userBId regardless of who requested.
    expect(rows[0].userAId < rows[0].userBId).toBe(true);
  });

  it("CONN-005 cannot send a request to yourself", async () => {
    const res = await sendRequest(alice.id, alice.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yourself/i);
    expect(fakePrisma._connections()).toHaveLength(0);
  });

  it("CONN-006 rejects a request to an unknown user", async () => {
    const res = await sendRequest(alice.id, "user_missing");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("CONN-007 prevents duplicate requests in the same direction", async () => {
    await sendRequest(alice.id, bob.id);
    const duplicate = await sendRequest(alice.id, bob.id);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("REQUEST_ALREADY_SENT");
    expect(fakePrisma._connections()).toHaveLength(1);
  });

  it("CONN-008 prevents a reverse-direction duplicate", async () => {
    await sendRequest(alice.id, bob.id);
    const reverse = await sendRequest(bob.id, alice.id);

    expect(reverse.status).toBe(409);
    expect(reverse.body.code).toBe("REQUEST_ALREADY_RECEIVED");
    expect(fakePrisma._connections()).toHaveLength(1);
  });

  it("CONN-009 prevents a request once the users are connected", async () => {
    const created = await sendRequest(alice.id, bob.id);
    await request(app)
      .post(`/api/connections/${created.body.connection.id}/accept`)
      .set(auth(tokenFor(bob.id)));

    const again = await sendRequest(alice.id, bob.id);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ALREADY_CONNECTED");
  });

  it("CONN-010 allows a new request after a rejection", async () => {
    const created = await sendRequest(alice.id, bob.id);
    await request(app)
      .post(`/api/connections/${created.body.connection.id}/reject`)
      .set(auth(tokenFor(bob.id)));

    const retry = await sendRequest(alice.id, bob.id);
    expect(retry.status).toBe(201);
    expect(retry.body.connection.status).toBe("pending");
    expect(fakePrisma._connections()).toHaveLength(1);
  });

  it("CONN-011 requires authentication", async () => {
    const res = await request(app)
      .post("/api/connections")
      .send({ userId: bob.id });
    expect(res.status).toBe(401);
  });
});

describe("CONN accepting and rejecting", () => {
  it("CONN-012 the addressee can accept, and both users see the connection", async () => {
    const created = await sendRequest(alice.id, bob.id);
    const id = created.body.connection.id;

    const accepted = await request(app)
      .post(`/api/connections/${id}/accept`)
      .set(auth(tokenFor(bob.id)));

    expect(accepted.status).toBe(200);
    expect(accepted.body.connection.status).toBe("accepted");

    const aliceList = await request(app)
      .get("/api/connections")
      .set(auth(tokenFor(alice.id)));
    expect(aliceList.body.connections).toHaveLength(1);
    expect(aliceList.body.connections[0].user).toMatchObject({
      id: bob.id,
      name: "Bob Brown",
    });

    const bobList = await request(app)
      .get("/api/connections")
      .set(auth(tokenFor(bob.id)));
    expect(bobList.body.connections[0].user).toMatchObject({ id: alice.id });

    // No longer waiting in either inbox.
    const pending = await request(app)
      .get("/api/connections/requests")
      .set(auth(tokenFor(bob.id)));
    expect(pending.body.requests).toEqual([]);
  });

  it("CONN-013 the requester cannot accept their own request", async () => {
    const created = await sendRequest(alice.id, bob.id);
    const res = await request(app)
      .post(`/api/connections/${created.body.connection.id}/accept`)
      .set(auth(tokenFor(alice.id)));

    expect(res.status).toBe(403);
    expect(fakePrisma._connections()[0].status).toBe("pending");
  });

  it("CONN-014 unrelated users cannot respond to a request", async () => {
    const created = await sendRequest(alice.id, bob.id);
    const res = await request(app)
      .post(`/api/connections/${created.body.connection.id}/accept`)
      .set(auth(tokenFor(carol.id)));

    expect(res.status).toBe(404);
    expect(fakePrisma._connections()[0].status).toBe("pending");
  });

  it("CONN-015 the addressee can reject, and the request disappears", async () => {
    const created = await sendRequest(alice.id, bob.id);

    const rejected = await request(app)
      .post(`/api/connections/${created.body.connection.id}/reject`)
      .set(auth(tokenFor(bob.id)));

    expect(rejected.status).toBe(200);
    expect(rejected.body.connection.status).toBe("rejected");

    const incoming = await request(app)
      .get("/api/connections/requests")
      .set(auth(tokenFor(bob.id)));
    expect(incoming.body.requests).toEqual([]);

    const list = await request(app)
      .get("/api/connections")
      .set(auth(tokenFor(alice.id)));
    expect(list.body.connections).toEqual([]);
  });

  it("CONN-016 cannot respond to an already resolved request", async () => {
    const created = await sendRequest(alice.id, bob.id);
    const id = created.body.connection.id;
    await request(app)
      .post(`/api/connections/${id}/accept`)
      .set(auth(tokenFor(bob.id)));

    const again = await request(app)
      .post(`/api/connections/${id}/accept`)
      .set(auth(tokenFor(bob.id)));
    expect(again.status).toBe(400);
  });

  it("CONN-017 requests are only listed for the addressee", async () => {
    await sendRequest(alice.id, bob.id);

    const bobInbox = await request(app)
      .get("/api/connections/requests")
      .set(auth(tokenFor(bob.id)));
    expect(bobInbox.body.requests).toHaveLength(1);
    expect(bobInbox.body.requests[0].user).toMatchObject({ id: alice.id });

    const aliceInbox = await request(app)
      .get("/api/connections/requests")
      .set(auth(tokenFor(alice.id)));
    expect(aliceInbox.body.requests).toEqual([]);

    const aliceSent = await request(app)
      .get("/api/connections/requests/sent")
      .set(auth(tokenFor(alice.id)));
    expect(aliceSent.body.requests).toHaveLength(1);
    expect(aliceSent.body.requests[0].user).toMatchObject({ id: bob.id });
  });
});

describe("CONN removing connections", () => {
  it("CONN-018 the requester can cancel a pending request", async () => {
    const created = await sendRequest(alice.id, bob.id);

    const cancelled = await request(app)
      .delete(`/api/connections/${created.body.connection.id}`)
      .set(auth(tokenFor(alice.id)));

    expect(cancelled.status).toBe(200);
    expect(fakePrisma._connections()).toHaveLength(0);

    // And can send it again.
    const retry = await sendRequest(alice.id, bob.id);
    expect(retry.status).toBe(201);
  });

  it("CONN-019 either side can remove an accepted connection", async () => {
    const created = await sendRequest(alice.id, bob.id);
    const id = created.body.connection.id;
    await request(app)
      .post(`/api/connections/${id}/accept`)
      .set(auth(tokenFor(bob.id)));

    const removed = await request(app)
      .delete(`/api/connections/${id}`)
      .set(auth(tokenFor(bob.id)));

    expect(removed.status).toBe(200);
    expect(fakePrisma._connections()).toHaveLength(0);

    const aliceList = await request(app)
      .get("/api/connections")
      .set(auth(tokenFor(alice.id)));
    expect(aliceList.body.connections).toEqual([]);
  });

  it("CONN-020 unrelated users cannot delete a connection", async () => {
    const created = await sendRequest(alice.id, bob.id);

    const res = await request(app)
      .delete(`/api/connections/${created.body.connection.id}`)
      .set(auth(tokenFor(carol.id)));

    expect(res.status).toBe(404);
    expect(fakePrisma._connections()).toHaveLength(1);
  });
});

describe("CONN authorization", () => {
  it("CONN-021 every connection endpoint requires a token", async () => {
    const responses = await Promise.all([
      request(app).get("/api/users"),
      request(app).get("/api/connections"),
      request(app).get("/api/connections/requests"),
      request(app).get("/api/connections/requests/sent"),
      request(app).post("/api/connections").send({ userId: bob.id }),
      request(app).post("/api/connections/anything/accept"),
      request(app).post("/api/connections/anything/reject"),
      request(app).delete("/api/connections/anything"),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });
});
