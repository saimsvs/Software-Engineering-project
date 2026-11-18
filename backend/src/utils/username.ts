import crypto from "node:crypto";
import { prisma } from "../config/db.js";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l look-alikes

function randomSuffix(length: number): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** "Ali Khan" -> "alikhan" (letters/digits only, max 15, "user" if empty). */
export function usernameBase(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
  return base || "user";
}

/** A username like "alikhan_7f3k" that no other user has. */
export async function generateUniqueUsername(name: string): Promise<string> {
  const base = usernameBase(name);
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${base}_${randomSuffix(attempt < 5 ? 4 : 6)}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error("Could not generate a unique username");
}
