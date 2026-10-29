import crypto from "crypto";

export function generateVerificationCode(): string {
  // Generate a secure 6-digit code
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function compareCodes(plainCode: string, hashedCode: string): boolean {
  const hashedPlain = hashCode(plainCode);
  return crypto.timingSafeEqual(
    Buffer.from(hashedPlain),
    Buffer.from(hashedCode)
  );
}
