// Create (or reset the password of) an organizer account.
// Usage (from backend/):
//   DATABASE_URL="EXTERNAL_DB_URL" npm run create-organizer -- someone@example.com "Their Name"
// The password is typed at a hidden prompt, or passed as ORGANIZER_PASSWORD='...'.
import bcrypt from "bcrypt";
import readline from "node:readline";
import { prisma } from "../config/db.js";

function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    console.error(
      "No interactive terminal. Pass the password instead: ORGANIZER_PASSWORD='...' npm run create-organizer -- email \"Name\""
    );
    process.exit(1);
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    process.stdout.write(question);
    out._writeToOutput = () => {};
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error('Usage: npm run create-organizer -- someone@example.com "Their Name"');
    process.exit(1);
  }
  const name = process.argv[3]?.trim() || email.split("@")[0];

  let password = process.env.ORGANIZER_PASSWORD ?? "";
  if (!password) {
    password = await askHidden(`Password for ${email}: `);
    const confirm = await askHidden("Type it again: ");
    if (password !== confirm) {
      console.error("Passwords do not match.");
      process.exit(1);
    }
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const organizer = await prisma.organizer.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, name, passwordHash },
  });

  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "unknown";
    }
  })();
  console.log(`Organizer ready: ${organizer.email} (${organizer.name}) in database at ${host}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
