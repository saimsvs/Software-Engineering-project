import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
  organizerFindUnique: vi.fn(),
  challengeCreate: vi.fn(),
  challengeFindMany: vi.fn(),
  challengeFindUnique: vi.fn(),
  challengeUpdate: vi.fn(),
  challengeDeleteMany: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  prisma: {
    organizer: { findUnique: mocks.organizerFindUnique },
    challenge: {
      create: mocks.challengeCreate,
      findMany: mocks.challengeFindMany,
      findUnique: mocks.challengeFindUnique,
      update: mocks.challengeUpdate,
      deleteMany: mocks.challengeDeleteMany,
    },
  },
}));

vi.mock("../src/config/env.js", () => ({
  env: { jwtSecret: "unit-test-only-secret" },
}));

import challengeRoutes from "../src/routes/challenges.js";
import express from "express";

const app = express();
app.use(express.json());
app.use("/api/challenges", challengeRoutes);

const token = (role: string, userId = "organizer-1") =>
  jwt.sign({ role, userId }, "unit-test-only-secret");

const valid = () => ({
  name: "Travel by Bus",
  description: "Use public transport",
  targetValue: 30,
  targetUnit: "km",
  targetDirection: "at_least",
  startDate: "2026-12-01T00:00:00.000Z",
  endDate: "2026-12-08T23:59:59.999Z",
  activityRules: {
    activityIds: ["bus", "train"],
    instructions: "Log your bus or train journeys",
  },
});

const dbChallenge = (overrides: Record<string, unknown> = {}) => ({
  id: "challenge-1",
  organizerId: "organizer-1",
  name: "Travel by Bus",
  description: "Use public transport",
  targetValue: 30,
  targetUnit: "km",
  targetDirection: "at_least",
  startDate: new Date("2099-12-01T00:00:00.000Z"),
  endDate: new Date("2099-12-08T23:59:59.999Z"),
  activityRules: { activityIds: ["bus"], instructions: "Log bus journeys" },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.organizerFindUnique.mockResolvedValue({ organizerId: "organizer-1" });
  mocks.challengeCreate.mockImplementation(async ({ data }) => ({
    ...dbChallenge(),
    ...data,
  }));
  mocks.challengeFindMany.mockResolvedValue([]);
  mocks.challengeFindUnique.mockResolvedValue(null);
  mocks.challengeUpdate.mockImplementation(async ({ data }) => ({
    ...dbChallenge(),
    ...data,
  }));

  mocks.challengeDeleteMany.mockResolvedValue({ count: 1 });
});

describe("US13: POST /api/challenges", () => {
  it("requires authentication", async () => {
    const r = await request(app).post("/api/challenges").send(valid());
    expect(r.status).toBe(401);
    expect(mocks.challengeCreate).not.toHaveBeenCalled();
  });

  it("rejects an ordinary user's token", async () => {
    const r = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token("user")}`)
      .send(valid());
    expect(r.status).toBe(403);
    expect(mocks.challengeCreate).not.toHaveBeenCalled();
  });

  it("rejects a fabricated organizer with no matching database record", async () => {
    mocks.organizerFindUnique.mockResolvedValue(null);
    const r = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send(valid());
    expect(r.status).toBe(403);
  });

  it("rejects an invalid JWT", async () => {
    const r = await request(app)
      .post("/api/challenges")
      .set("Authorization", "Bearer invalid-token")
      .send(valid());
    expect(r.status).toBe(401);
  });

  it("creates a valid challenge with organizer ownership", async () => {
    const r = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send(valid());
    expect(r.status).toBe(201);
    expect(r.body.message).toMatch(/created/i);
    expect(mocks.challengeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizerId: "organizer-1",
        targetDirection: "at_least",
        targetUnit: "km",
        activityRules: { activityIds: ["bus", "train"], instructions: "Log your bus or train journeys" },
      }),
    });
  });

  it.each([
    ["missing name", { name: "" }],
    ["missing description", { description: "" }],
    ["zero target", { targetValue: 0 }],
    ["negative target", { targetValue: -5 }],
    ["invalid direction", { targetDirection: "more" }],
    ["unrecognized target unit", { targetUnit: "litres-of-fuel" }],
    ["end before start", { endDate: "2026-11-01T00:00:00.000Z" }],
    ["invalid start date", { startDate: "2026-12-01" }],
    ["fractional activity target", { targetUnit: "activities", targetValue: 2.5 }],
    ["fractional days target", { targetUnit: "days", targetValue: 2.5 }],
  ])("rejects %s", async (_label, override) => {
    const r = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ ...valid(), ...override });
    expect(r.status).toBe(400);
    expect(r.body.fieldErrors).toBeDefined();
    expect(mocks.challengeCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["unsupported activity", ["teleport"], "activities"],
    ["empty activities", [], "activities"],
    ["duplicate activities", ["bus", "bus"], "activities"],
    ["incompatible km with electricity", ["bus", "electricity"], "km"],
    ["incompatible meal with bus", ["bus"], "meal"],
  ])("rejects %s", async (_label, activityIds, targetUnit) => {
    const r = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ ...valid(), targetUnit, activityRules: { activityIds, instructions: "Test" } });
    expect(r.status).toBe(400);
    expect(mocks.challengeCreate).not.toHaveBeenCalled();
  });

  it("accepts at-most consumption budgets", async () => {
    const r = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({
        ...valid(),
        targetValue: 100,
        targetUnit: "kWh",
        targetDirection: "at_most",
        activityRules: { activityIds: ["electricity"], instructions: "Stay below 100 kWh" },
      });
    expect(r.status).toBe(201);
  });
});

describe("US13: GET /api/challenges", () => {
  it("lists challenges without requiring an organizer token", async () => {
    mocks.challengeFindMany.mockResolvedValue([dbChallenge()]);
    const r = await request(app).get("/api/challenges");
    expect(r.status).toBe(200);
    expect(r.body.challenges).toHaveLength(1);
    expect(r.body.challenges[0].status).toBe("upcoming");
  });

  it("returns 404 for a nonexistent challenge", async () => {
    const r = await request(app).get("/api/challenges/missing");
    expect(r.status).toBe(404);
  });

  it.each([
    ["upcoming", "2099-12-01T00:00:00.000Z", "2099-12-08T00:00:00.000Z"],
    ["active", "2020-01-01T00:00:00.000Z", "2099-12-08T00:00:00.000Z"],
    ["completed", "2020-01-01T00:00:00.000Z", "2020-01-08T00:00:00.000Z"],
  ])("calculates %s status", async (status, start, end) => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({ startDate: new Date(start), endDate: new Date(end) })
    );
    const r = await request(app).get("/api/challenges/challenge-1");
    expect(r.status).toBe(200);
    expect(r.body.challenge.status).toBe(status);
  });
});


describe("US24: PATCH /api/challenges/:id", () => {
  it("requires authentication", async () => {
    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .send({ description: "Updated description" });

    expect(r.status).toBe(401);
    expect(mocks.challengeUpdate).not.toHaveBeenCalled();
  });

  it("rejects ordinary users", async () => {
    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("user")}`)
      .send({ description: "Updated description" });

    expect(r.status).toBe(403);
  });

  it("returns 404 for a missing challenge", async () => {
    const r = await request(app)
      .patch("/api/challenges/missing")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ description: "Updated description" });

    expect(r.status).toBe(404);
  });

  it("allows editing a challenge created by another organizer", async () => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({ organizerId: "organizer-2" })
    );

    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ description: "Updated by another organizer" });

    expect(r.status).toBe(200);

    expect(mocks.challengeUpdate).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
      data: {
        description: "Updated by another organizer",
      },
    });
  });

  it("allows editing an upcoming challenge", async () => {
    mocks.challengeFindUnique.mockResolvedValue(dbChallenge());

    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({
        name: "New Challenge Name",
        description: "New description",
      });

    expect(r.status).toBe(200);
    expect(mocks.challengeUpdate).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
      data: expect.objectContaining({
        name: "New Challenge Name",
        description: "New description",
      }),
    });
  });

  it("rejects an end date before the start date", async () => {
    mocks.challengeFindUnique.mockResolvedValue(dbChallenge());

    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({
        endDate: "2099-11-01T00:00:00.000Z",
      });

    expect(r.status).toBe(400);
    expect(mocks.challengeUpdate).not.toHaveBeenCalled();
  });

  it("allows changing the description of an active challenge", async () => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({
        startDate: new Date("2020-01-01T00:00:00.000Z"),
      })
    );

    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ description: "Updated active challenge" });

    expect(r.status).toBe(200);
  });

  it("prevents changing the name of an active challenge", async () => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({
        startDate: new Date("2020-01-01T00:00:00.000Z"),
      })
    );

    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ name: "Changed name" });

    expect(r.status).toBe(409);
    expect(mocks.challengeUpdate).not.toHaveBeenCalled();
  });

  it("prevents editing completed challenges", async () => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({
        startDate: new Date("2020-01-01T00:00:00.000Z"),
        endDate: new Date("2020-01-08T00:00:00.000Z"),
      })
    );

    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ description: "Changed description" });

    expect(r.status).toBe(409);
    expect(mocks.challengeUpdate).not.toHaveBeenCalled();
  });

  it("rejects unsupported fields", async () => {
    mocks.challengeFindUnique.mockResolvedValue(dbChallenge());

    const r = await request(app)
      .patch("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`)
      .send({ organizerId: "organizer-2" });

    expect(r.status).toBe(400);
    expect(mocks.challengeUpdate).not.toHaveBeenCalled();
  });
});

describe("US24: DELETE /api/challenges/:id", () => {
  it("requires authentication", async () => {
    const r = await request(app)
      .delete("/api/challenges/challenge-1");

    expect(r.status).toBe(401);
  });

  it("allows deleting a challenge created by another organizer", async () => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({ organizerId: "organizer-2" })
    );

    const r = await request(app)
      .delete("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`);

    expect(r.status).toBe(200);

    expect(mocks.challengeDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "challenge-1",
        startDate: { gt: expect.any(Date) },
      },
    });
  });

  it("allows deleting an upcoming challenge", async () => {
    mocks.challengeFindUnique.mockResolvedValue(dbChallenge());

    const r = await request(app)
      .delete("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`);

    expect(r.status).toBe(200);
    expect(mocks.challengeDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "challenge-1",
        startDate: { gt: expect.any(Date) },
      },
    });
  });

  it("prevents deleting an active challenge", async () => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({
        startDate: new Date("2020-01-01T00:00:00.000Z"),
      })
    );

    const r = await request(app)
      .delete("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`);

    expect(r.status).toBe(409);
    expect(mocks.challengeDeleteMany).not.toHaveBeenCalled();
  });

  it("prevents deleting a completed challenge", async () => {
    mocks.challengeFindUnique.mockResolvedValue(
      dbChallenge({
        startDate: new Date("2020-01-01T00:00:00.000Z"),
        endDate: new Date("2020-01-08T00:00:00.000Z"),
      })
    );

    const r = await request(app)
      .delete("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`);

    expect(r.status).toBe(409);
  });

  it("handles a challenge changing status during deletion", async () => {
    mocks.challengeFindUnique.mockResolvedValue(dbChallenge());
    mocks.challengeDeleteMany.mockResolvedValue({ count: 0 });

    const r = await request(app)
      .delete("/api/challenges/challenge-1")
      .set("Authorization", `Bearer ${token("organizer")}`);

    expect(r.status).toBe(409);
  });
});

