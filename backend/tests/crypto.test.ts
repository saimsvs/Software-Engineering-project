import { describe, expect, it } from "vitest";
import {
  compareCodes,
  generateVerificationCode,
  hashCode,
} from "../src/utils/crypto.js";

describe("verification code utilities", () => {
  it("generates six-digit numeric codes", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThan(1000000);
    }
  });

  it("hashes codes with SHA-256 (never stores the plaintext)", () => {
    // Known SHA-256 digest of "123456".
    expect(hashCode("123456")).toBe(
      "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"
    );
    expect(hashCode("123456")).not.toBe("123456");
    expect(hashCode("123456")).toBe(hashCode("123456"));
  });

  it("compares a plaintext code against its hash", () => {
    const code = generateVerificationCode();
    expect(compareCodes(code, hashCode(code))).toBe(true);
    expect(compareCodes("000000", hashCode(code))).toBe(code === "000000");
    expect(compareCodes("abcdef", hashCode(code))).toBe(false);
  });
});
