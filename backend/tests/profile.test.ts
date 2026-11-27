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

function seedUser(name: string, username: string) {
  return fakePrisma.seed.user({
    name,
    username,
    email: `${username}@example.com`,
    passwordHash: "irrelevant-for-profile-tests",
    emailVerified: true,
  });
}

function openProfile(viewerId: string, targetId: string) {
  return request(app)
    .get(`/api/users/${targetId}/profile`)
    .set(auth(tokenFor(viewerId)));
}

const future = new Date(Date.now() + 7 * 86400000);

let alice: ReturnType<typeof seedUser>;
let bob: ReturnType<typeof seedUser>;

beforeEach(() => {
  fakePrisma.reset();
  alice = seedUser("Alice Green", "alice");
  bob = seedUser("Bob Brown", "bob");
});

describe("PROFILE public profile", () => {
  it("PROFILE-001 opens another user's profile with only public identity fields", async () => {
    const res = await openProfile(alice.id, bob.id);

    expect(res.status).toBe(200);
    expect(res.body.profile.user).toEqual({
      id: bob.id,
      name: "Bob Brown",
      username: "bob",
    });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("bob@example.com");
  });

  it("PROFILE-002 returns public goals only, with progress and no owner id", async () => {
    fakePrisma.seed.goal({
      userId: bob.id,
      name: "Public bike goal",
      targetValue: 5,
      targetUnit: "activities",
      category: "Transport",
      deadline: future,
      isPublic: true,
    });
    fakePrisma.seed.goal({
      userId: bob.id,
      name: "Secret diet goal",
      targetValue: 2,
      targetUnit: "activities",
      category: "Food",
      deadline: future,
      isPublic: false,
    });

    const res = await openProfile(alice.id, bob.id);

    expect(res.status).toBe(200);
    expect(res.body.profile.goals).toHaveLength(1);
    expect(res.body.profile.goals[0]).toMatchObject({
      name: "Public bike goal",
      category: "Transport",
    });
    expect(res.body.profile.goals[0].progress).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain("Secret diet goal");
    expect(JSON.stringify(res.body)).not.toContain("userId");
  });

  it("PROFILE-003 hides trends when the setting is missing or disabled", async () => {
    fakePrisma.seed.activity({
      userId: bob.id,
      activityId: "cycle",
      category: "Transport",
      distance: 10,
      unit: "km",
      emission: 2.5,
      note: "private note",
      createdAt: new Date(),
    });
    fakePrisma.seed.privacySetting({ userId: bob.id, showTrendsPublic: false });

    const res = await openProfile(alice.id, bob.id);

    expect(res.status).toBe(200);
    expect(res.body.profile.trends).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("private note");
    expect(JSON.stringify(res.body)).not.toContain("2.5");
  });

  it("PROFILE-004 shows aggregated trends only when the owner enabled them", async () => {
    fakePrisma.seed.privacySetting({ userId: bob.id, showTrendsPublic: true });
    fakePrisma.seed.activity({
      userId: bob.id,
      activityId: "cycle",
      category: "Transport",
      distance: 10,
      unit: "km",
      emission: 2.5,
      note: "private note",
      createdAt: new Date(),
    });

    const res = await openProfile(alice.id, bob.id);

    expect(res.status).toBe(200);
    expect(res.body.profile.trends.totalKg).toBe(2.5);
    expect(res.body.profile.trends.activityCount).toBe(1);
    expect(res.body.profile.trends.days).toHaveLength(7);
    expect(res.body.profile.trends.byCategory[0]).toMatchObject({ category: "Transport", kg: 2.5 });
    expect(JSON.stringify(res.body)).not.toContain("private note");
    expect(JSON.stringify(res.body)).not.toContain("bob@example.com");
  });

  it("PROFILE-005 has no challenges to show until a challenge feature exists", async () => {
    const res = await openProfile(alice.id, bob.id);
    expect(res.body.profile.challenges).toEqual([]);
    expect(Array.isArray(res.body.profile.challenges)).toBe(true);
  });

  it("PROFILE-006 reports unknown users and requires a token", async () => {
    expect((await openProfile(alice.id, "user_missing")).status).toBe(404);
    expect((await request(app).get(`/api/users/${bob.id}/profile`)).status).toBe(401);
  });
});

describe("PROFILE privacy controls", () => {
  it("PROFILE-007 privacy settings default to private and can be updated by the owner", async () => {
    const before = await request(app)
      .get("/api/features/privacy")
      .set(auth(tokenFor(alice.id)));
    expect(before.body.settings).toMatchObject({
      locationSharingEnabled: false,
      showTrendsPublic: false,
    });

    const saved = await request(app)
      .put("/api/features/privacy")
      .set(auth(tokenFor(alice.id)))
      .send({ locationSharingEnabled: false, showTrendsPublic: true });
    expect(saved.status).toBe(200);
    expect(saved.body.settings.showTrendsPublic).toBe(true);

    const after = await openProfile(bob.id, alice.id);
    expect(after.body.profile.trends).not.toBeNull();
    expect(fakePrisma._privacySettings()[0].userId).toBe(alice.id);
  });

  it("PROFILE-008 rejects invalid privacy settings", async () => {
    const res = await request(app)
      .put("/api/features/privacy")
      .set(auth(tokenFor(alice.id)))
      .send({ showTrendsPublic: "yes" });
    expect(res.status).toBe(400);
  });

  it("PROFILE-009 a goal's owner can change its visibility, nobody else can", async () => {
    const goal = fakePrisma.seed.goal({
      userId: bob.id,
      name: "Bike goal",
      targetValue: 5,
      targetUnit: "activities",
      category: null,
      deadline: future,
      isPublic: false,
    });

    const stranger = await request(app)
      .patch(`/api/features/goals/${goal.id}`)
      .set(auth(tokenFor(alice.id)))
      .send({ isPublic: true });
    expect(stranger.status).toBe(404);
    expect(fakePrisma._goals()[0].isPublic).toBe(false);

    const shared = await request(app)
      .patch(`/api/features/goals/${goal.id}`)
      .set(auth(tokenFor(bob.id)))
      .send({ isPublic: true });
    expect(shared.status).toBe(200);
    expect(shared.body.goal.isPublic).toBe(true);

    const visible = await openProfile(alice.id, bob.id);
    expect(visible.body.profile.goals.map((g: any) => g.name)).toEqual(["Bike goal"]);

    const invalid = await request(app)
      .patch(`/api/features/goals/${goal.id}`)
      .set(auth(tokenFor(bob.id)))
      .send({ isPublic: "true" });
    expect(invalid.status).toBe(400);
  });

  it("PROFILE-010 users can view their own public profile without leaking account fields", async () => {
    const res = await openProfile(alice.id, alice.id);
    expect(res.status).toBe(200);
    expect(res.body.profile.user.id).toBe(alice.id);
    expect(JSON.stringify(res.body)).not.toContain("alice@example.com");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});
