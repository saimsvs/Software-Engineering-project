import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";

// Render's INTERNAL database URL (host like "dpg-xxxx-a", no dots) does not
// accept SSL; the EXTERNAL URL (host "...render.com") requires it.
function needsSsl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.includes(".") && host !== "127.0.0.1";
  } catch {
    return true;
  }
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: needsSsl(env.databaseUrl) ? { rejectUnauthorized: false } : false,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
