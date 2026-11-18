import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { hashCode } from "../src/utils/crypto.js";
import { fakePrisma, sendVerificationCodeMock } from "./setup.js";

const app = createApp();

const validUser = {
  name: "Test User",
  email: "user@example.com",
  password: "password123",
};

function lastEmailedCode(): string {
  const call = sendVerificationCodeMock.mock.calls.at(-1);
  if (!call) throw new Error("Expected a verification email to be sent");
  return call[0].code;
}

function register(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/auth/register")
    .send({ ...validUser, ...overrides });
}

beforeEach(() => {
  fakePrisma.reset();
  sendVerificationCodeMock.mockClear();
});

describe("AUTH-REG registration", () => {
  it("AUTH-REG-001 registers a user, stores a hashed code and sends an email", async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(validUser.email);
    expect(res.body.message).toMatch(/verification code/i);
    // Registration must never auto-login.
    expect(res.body.token).toBeUndefined();

    const users = fakePrisma._users();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(validUser.email);
    expect(users[0].emailVerified).toBe(false);
    expect(users[0].passwordHash).not.toBe(validUser.password);

    // SEC-002: the plaintext code is never persisted.
    const codes = fakePrisma._codes();
    expect(codes).toHaveLength(1);
    const emailedCode = lastEmailedCode();
    expect(emailedCode).toMatch(/^\d{6}$/);
    expect(codes[0].codeHash).toBe(hashCode(emailedCode));
    expect(codes[0].codeHash).not.toBe(emailedCode);
  });

  it("AUTH-REG-002 rejects a duplicate email", async () => {
    await register();
    const res = await register();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
    expect(fakePrisma._users()).toHaveLength(1);
  });

  it.each([
    ["missing name", { name: "" }],
    ["invalid email", { email: "not-an-email" }],
    ["short password", { password: "short" }],
  ])("AUTH-REG-003 rejects invalid payload: %s", async (_label, override) => {
    const res = await register(override);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid input/i);
    expect(fakePrisma._users()).toHaveLength(0);
  });

  it("AUTH-REG-004 still succeeds when the email provider fails", async () => {
    sendVerificationCodeMock.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await register();

    expect(res.status).toBe(201);
    expect(fakePrisma._users()).toHaveLength(1);
  });
});

describe("AUTH-VER email verification", () => {
  it("AUTH-VER-001 verifies the email with the correct code", async () => {
    await register();
    const code = lastEmailedCode();

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified successfully/i);
    expect(fakePrisma._users()[0].emailVerified).toBe(true);
    expect(fakePrisma._codes()).toHaveLength(0);
  });

  it("AUTH-VER-002 rejects a wrong code and counts the attempt", async () => {
    await register();

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid verification code/i);
    expect(fakePrisma._users()[0].emailVerified).toBe(false);
    expect(fakePrisma._codes()[0].attempts).toBe(1);
  });

  it("AUTH-VER-003 rejects an expired code and deletes it", async () => {
    await register();
    fakePrisma._codes()[0].expiresAt = new Date(Date.now() - 1000);

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code: lastEmailedCode() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
    expect(fakePrisma._codes()).toHaveLength(0);
  });

  it("AUTH-VER-004 blocks verification after five failed attempts", async () => {
    await register();
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/auth/verify-code")
        .send({ email: validUser.email, code: "000000" });
    }
    expect(fakePrisma._codes()[0].attempts).toBe(5);

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code: lastEmailedCode() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too many failed attempts/i);
    expect(fakePrisma._codes()).toHaveLength(0);
    expect(fakePrisma._users()[0].emailVerified).toBe(false);
  });

  it("AUTH-VER-005 resend replaces the previous code", async () => {
    await register();
    const firstCode = lastEmailedCode();

    const res = await request(app)
      .post("/api/auth/resend-code")
      .send({ email: validUser.email });

    expect(res.status).toBe(200);
    expect(sendVerificationCodeMock).toHaveBeenCalledTimes(2);
    expect(fakePrisma._codes()).toHaveLength(1);

    const secondCode = lastEmailedCode();
    // The old code is no longer accepted (only the newest hash is stored).
    if (secondCode !== firstCode) {
      const old = await request(app)
        .post("/api/auth/verify-code")
        .send({ email: validUser.email, code: firstCode });
      expect(old.status).toBe(400);
    }
  });

  it("AUTH-VER-006 resend for an already verified email says so and sends nothing", async () => {
    await register();
    await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code: lastEmailedCode() });
    sendVerificationCodeMock.mockClear();

    const res = await request(app)
      .post("/api/auth/resend-code")
      .send({ email: validUser.email });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already verified/i);
    expect(sendVerificationCodeMock).not.toHaveBeenCalled();
  });

  it("AUTH-VER-007 resend for an unknown email does not reveal account existence", async () => {
    const res = await request(app)
      .post("/api/auth/resend-code")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
    expect(sendVerificationCodeMock).not.toHaveBeenCalled();
  });

  it("AUTH-VER-008 rejects verification for an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "nobody@example.com", code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid verification code/i);
  });

  it("AUTH-VER-009 rejects verification when the email is already verified", async () => {
    await register();
    await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code: lastEmailedCode() });

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already verified/i);
  });

  it("AUTH-VER-010 rejects a code that is not six digits", async () => {
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: validUser.email, code: "12345" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid input/i);
  });
});

describe("AUTH-LOG login and session", () => {
  it("AUTH-LOG-001 logs in a verified user without leaking the password hash", async () => {
    fakePrisma.seed.user({
      name: validUser.name,
      email: validUser.email,
      passwordHash: await bcrypt.hash(validUser.password, 4),
      emailVerified: true,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({
      email: validUser.email,
      role: "user",
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.emailVerified).toBeUndefined();
  });

  it("AUTH-LOG-002 login is allowed before verification (verification is enforced at registration flow)", async () => {
    fakePrisma.seed.user({
      name: validUser.name,
      email: validUser.email,
      passwordHash: await bcrypt.hash(validUser.password, 4),
      emailVerified: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("user");
  });

  it("AUTH-LOG-003 rejects a wrong password", async () => {
    fakePrisma.seed.user({
      name: validUser.name,
      email: validUser.email,
      passwordHash: await bcrypt.hash(validUser.password, 4),
      emailVerified: true,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
    expect(res.body.token).toBeUndefined();
  });

  it("AUTH-LOG-004 rejects an unknown email with the same generic error", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("AUTH-LOG-005 /me returns the profile for a valid token", async () => {
    const user = fakePrisma.seed.user({
      name: validUser.name,
      email: validUser.email,
      passwordHash: "hash",
      emailVerified: true,
    });
    const token = jwt.sign({ userId: user.id, role: "user" }, env.jwtSecret);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: validUser.email,
      emailVerified: true,
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("AUTH-LOG-006 /me rejects missing or invalid tokens", async () => {
    const missing = await request(app).get("/api/auth/me");
    expect(missing.status).toBe(401);

    const invalid = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(invalid.status).toBe(401);
  });

  it("AUTH-LOG-007 /me returns 404 when the token points at a missing user", async () => {
    const token = jwt.sign({ userId: "user_missing" }, env.jwtSecret);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe("ORG organizer login", () => {
  const organizer = {
    name: "Organizer One",
    email: "organizer@example.com",
    password: "organizer-pass",
  };

  beforeEach(async () => {
    fakePrisma.seed.organizer({
      name: organizer.name,
      email: organizer.email,
      passwordHash: await bcrypt.hash(organizer.password, 4),
    });
  });

  it("ORG-001 logs an organizer in with the organizer role", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: organizer.email, password: organizer.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({
      name: organizer.name,
      email: organizer.email,
      role: "organizer",
    });
    expect(res.body.user.passwordHash).toBeUndefined();

    const payload = jwt.verify(res.body.token, env.jwtSecret) as {
      userId: string;
      role: string;
    };
    expect(payload.role).toBe("organizer");
    expect(payload.userId).toBe(fakePrisma._organizers()[0].organizerId);
  });

  it("ORG-004 rejects an organizer with a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: organizer.email, password: "nope" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("ORG-005 organizer lookup takes precedence over a regular user with the same email", async () => {
    fakePrisma.seed.user({
      name: "Regular",
      email: organizer.email,
      passwordHash: await bcrypt.hash(organizer.password, 4),
      emailVerified: true,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: organizer.email, password: organizer.password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("organizer");
  });
});
