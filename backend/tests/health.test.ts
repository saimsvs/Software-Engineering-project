import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import "./setup.js";

const app = createApp();

describe("SEC-004 health endpoint", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
