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

function seedUser(email: string) {
  return fakePrisma.seed.user({
    name: email.split("@")[0],
    email,
    passwordHash: "irrelevant-for-activity-tests",
    emailVerified: true,
  });
}

const baseActivity = {
  activityId: "car-petrol",
  category: "transport",
  distance: 100,
  unit: "km",
};

beforeEach(() => {
  fakePrisma.reset();
});

describe("ACT activity logging (authenticated API)", () => {
  it("ACT-001 creates an activity and computes the emission server-side", async () => {
    const user = seedUser("alice@example.com");

    const res = await request(app)
      .post("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(user.id)}`)
      .send(baseActivity);

    expect(res.status).toBe(201);
    expect(res.body.activity).toMatchObject({
      userId: user.id,
      activityId: "car-petrol",
      distance: 100,
      unit: "km",
      emission: 19.2, // 100 km * 0.192 kg CO2/km
    });
    expect(fakePrisma._activities()).toHaveLength(1);
  });

  it("ACT-001b ignores client-supplied emissions and converts miles", async () => {
    const user = seedUser("alice@example.com");

    const res = await request(app)
      .post("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(user.id)}`)
      .send({ ...baseActivity, distance: 100, unit: "miles", emission: 0 });

    expect(res.status).toBe(201);
    // 100 miles -> 160.934 km * 0.192 = 30.899... -> 30.9
    expect(res.body.activity.emission).toBe(30.9);
    expect(res.body.activity.unit).toBe("miles");
  });

  it("ACT-001c rounds emissions to one decimal place", async () => {
    const user = seedUser("alice@example.com");

    const res = await request(app)
      .post("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(user.id)}`)
      .send({
        activityId: "beef-meal",
        category: "food",
        distance: 1.5,
        unit: "kg",
      });

    expect(res.status).toBe(201);
    // 1.5 * 2.7 = 4.05 -> 4.1
    expect(res.body.activity.emission).toBe(4.1);
  });

  it("ACT-002 lists only the current user's activities, newest first", async () => {
    const alice = seedUser("alice@example.com");
    const bob = seedUser("bob@example.com");
    fakePrisma.seed.activity({ userId: alice.id, activityId: "bus", emission: 1 });
    fakePrisma.seed.activity({ userId: alice.id, activityId: "train", emission: 2 });
    fakePrisma.seed.activity({ userId: bob.id, activityId: "taxi", emission: 3 });

    const res = await request(app)
      .get("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(alice.id)}`);

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(2);
    expect(res.body.activities.every((a: any) => a.userId === alice.id)).toBe(
      true
    );
    expect(res.body.activities[0].activityId).toBe("train");
  });

  it("ACT-002b ?all=1 returns the full history instead of the latest 10", async () => {
    const user = seedUser("alice@example.com");
    for (let i = 0; i < 12; i++) {
      fakePrisma.seed.activity({ userId: user.id, activityId: "bus", emission: i });
    }

    const recent = await request(app)
      .get("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(user.id)}`);
    expect(recent.body.activities).toHaveLength(10);

    const all = await request(app)
      .get("/api/auth/activity?all=1")
      .set("Authorization", `Bearer ${tokenFor(user.id)}`);
    expect(all.body.activities).toHaveLength(12);
  });

  it("ACT-003 updates an owned activity and recomputes the emission", async () => {
    const user = seedUser("alice@example.com");
    const created = await request(app)
      .post("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(user.id)}`)
      .send(baseActivity);

    const res = await request(app)
      .patch(`/api/auth/activity/${created.body.activity.id}`)
      .set("Authorization", `Bearer ${tokenFor(user.id)}`)
      .send({ ...baseActivity, distance: 10 });

    expect(res.status).toBe(200);
    expect(res.body.activity.distance).toBe(10);
    expect(res.body.activity.emission).toBe(1.9); // 10 * 0.192 = 1.92 -> 1.9
  });

  it("ACT-004 deletes an owned activity", async () => {
    const user = seedUser("alice@example.com");
    const created = await request(app)
      .post("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(user.id)}`)
      .send(baseActivity);

    const res = await request(app)
      .delete(`/api/auth/activity/${created.body.activity.id}`)
      .set("Authorization", `Bearer ${tokenFor(user.id)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Deleted",
      id: created.body.activity.id,
    });
    expect(fakePrisma._activities()).toHaveLength(0);
  });

  it("ACT-005 prevents one user from reading/editing/deleting another user's activity", async () => {
    const alice = seedUser("alice@example.com");
    const bob = seedUser("bob@example.com");
    const alicesActivity = fakePrisma.seed.activity({
      userId: alice.id,
      activityId: "bus",
      category: "transport",
      distance: 5,
      unit: "km",
      emission: 0.4,
    });

    const patch = await request(app)
      .patch(`/api/auth/activity/${alicesActivity.id}`)
      .set("Authorization", `Bearer ${tokenFor(bob.id)}`)
      .send({ ...baseActivity, distance: 999 });
    expect(patch.status).toBe(404);

    const del = await request(app)
      .delete(`/api/auth/activity/${alicesActivity.id}`)
      .set("Authorization", `Bearer ${tokenFor(bob.id)}`);
    expect(del.status).toBe(404);

    const list = await request(app)
      .get("/api/auth/activity")
      .set("Authorization", `Bearer ${tokenFor(bob.id)}`);
    expect(list.body.activities).toHaveLength(0);

    // Alice's data is untouched.
    const stored = fakePrisma._activities()[0];
    expect(stored.distance).toBe(5);
    expect(stored.emission).toBe(0.4);
  });

  it("ACT-006 rejects invalid payloads", async () => {
    const user = seedUser("alice@example.com");
    const auth = { Authorization: `Bearer ${tokenFor(user.id)}` };

    const missingDistance = await request(app)
      .post("/api/auth/activity")
      .set(auth)
      .send({ activityId: "bus", category: "transport", unit: "km" });
    expect(missingDistance.status).toBe(400);

    const negativeDistance = await request(app)
      .post("/api/auth/activity")
      .set(auth)
      .send({ ...baseActivity, distance: -5 });
    expect(negativeDistance.status).toBe(400);

    const unknownActivity = await request(app)
      .post("/api/auth/activity")
      .set(auth)
      .send({ ...baseActivity, activityId: "teleportation" });
    expect(unknownActivity.status).toBe(400);
    expect(unknownActivity.body.message).toMatch(/unknown activity/i);

    const longNote = await request(app)
      .post("/api/auth/activity")
      .set(auth)
      .send({ ...baseActivity, note: "x".repeat(501) });
    expect(longNote.status).toBe(400);

    expect(fakePrisma._activities()).toHaveLength(0);
  });

  it("ACT-007 requires a valid token on every activity endpoint", async () => {
    const endpoints = [
      request(app).post("/api/auth/activity").send(baseActivity),
      request(app).get("/api/auth/activity"),
      request(app).patch("/api/auth/activity/whatever").send(baseActivity),
      request(app).delete("/api/auth/activity/whatever"),
    ];

    for (const response of await Promise.all(endpoints)) {
      expect(response.status).toBe(401);
    }

    const badToken = await request(app)
      .get("/api/auth/activity")
      .set("Authorization", "Bearer nope");
    expect(badToken.status).toBe(401);
  });
});
