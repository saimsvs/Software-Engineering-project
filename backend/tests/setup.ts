import { vi } from "vitest";
import { createFakePrisma } from "./helpers/fakePrisma.js";

// Keep tests hermetic: no real database, no real email provider, fixed JWT secret.
process.env.JWT_SECRET = "test-secret";
process.env.VERIFICATION_CODE_EXP_MIN ||= "10";

export const fakePrisma = createFakePrisma();

export const sendVerificationCodeMock = vi.fn(
  async (_args: { to: string; name: string; code: string }) => {}
);

vi.mock("../src/config/db.js", () => ({ prisma: fakePrisma }));

vi.mock("../src/services/email.js", () => ({
  sendVerificationCode: sendVerificationCodeMock,
}));
