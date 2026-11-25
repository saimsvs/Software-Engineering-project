import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { buildPublicProfile } from "../services/publicProfile.js";

export const usersRouter = Router();
export const connectionsRouter = Router();

const requestSchema = z.object({
  userId: z.string().min(1),
});

type ConnectionRow = {
  id: string;
  userAId: string;
  userBId: string;
  requestedById: string;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
};

const PUBLIC_USER = { id: true, name: true, username: true } as const;

type PublicUser = { id: string; name: string; username: string };

function otherUserId(connection: ConnectionRow, meId: string): string {
  return connection.userAId === meId ? connection.userBId : connection.userAId;
}

/**
 * The relationship from the current user's point of view. A rejected request is
 * reported as "none" so the UI lets the user try again.
 */
function relationship(
  connection: ConnectionRow | undefined,
  meId: string
):
  | { relationship: "none" }
  | { relationship: "connected"; connectionId: string }
  | { relationship: "request_sent"; connectionId: string }
  | { relationship: "request_received"; connectionId: string } {
  if (!connection) return { relationship: "none" };

  if (connection.status === "accepted") {
    return { relationship: "connected", connectionId: connection.id };
  }

  if (connection.status === "pending") {
    return connection.requestedById === meId
      ? { relationship: "request_sent", connectionId: connection.id }
      : { relationship: "request_received", connectionId: connection.id };
  }

  return { relationship: "none" };
}

/** Every connection row that involves this user, in either column. */
async function connectionsFor(userId: string): Promise<ConnectionRow[]> {
  const [asA, asB] = await Promise.all([
    prisma.connection.findMany({ where: { userAId: userId } }),
    prisma.connection.findMany({ where: { userBId: userId } }),
  ]);
  return [...(asA as ConnectionRow[]), ...(asB as ConnectionRow[])];
}

async function usersByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, PublicUser>();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: PUBLIC_USER,
  });
  return new Map(users.map((user) => [user.id, user]));
}

// ---------------------------------------------------------------------------
// GET /api/users?q= — search for / discover other users
// ---------------------------------------------------------------------------
usersRouter.get("/", requireAuth, async (req, res) => {
  const meId = req.userId!;
  const query = String(req.query.q ?? "").trim();
  const parsedLimit = Number.parseInt(String(req.query.limit ?? "20"), 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 50)
    : 20;

  const where: any = { id: { not: meId } };
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { username: { contains: query.replace(/^@/, ""), mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: query ? { name: "asc" } : { createdAt: "desc" },
    take: limit,
    select: PUBLIC_USER,
  });

  const existing = await connectionsFor(meId);
  const byOtherUser = new Map(
    existing.map((connection) => [otherUserId(connection, meId), connection])
  );

  res.json({
    users: users.map((user) => ({
      ...user,
      ...relationship(byOtherUser.get(user.id), meId),
    })),
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id/profile — another user's public carbon profile
// ---------------------------------------------------------------------------
// The response is assembled server-side from only the fields the profile owner
// marked public. Private goals, private challenges and hidden trends never
// enter the payload, and no email/password fields are selected.
usersRouter.get("/:id/profile", requireAuth, async (req, res) => {
  const userId = String(req.params.id);
  if (!userId) return res.status(400).json({ message: "Invalid user id" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER,
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  const shared = await buildPublicProfile(userId);
  res.json({ profile: { user, ...shared } });
});

// ---------------------------------------------------------------------------
// GET /api/connections — accepted connections
// ---------------------------------------------------------------------------
connectionsRouter.get("/", requireAuth, async (req, res) => {
  const meId = req.userId!;

  const rows = (await prisma.connection.findMany({
    where: {
      status: "accepted",
      OR: [{ userAId: meId }, { userBId: meId }],
    },
    orderBy: { respondedAt: "desc" },
  })) as ConnectionRow[];

  const users = await usersByIds(rows.map((row) => otherUserId(row, meId)));

  res.json({
    connections: rows.map((row) => {
      const otherId = otherUserId(row, meId);
      return {
        id: row.id,
        connectedAt: row.respondedAt,
        user: users.get(otherId) ?? { id: otherId, name: "Unknown user", username: "" },
      };
    }),
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/requests — pending requests waiting on me
// ---------------------------------------------------------------------------
connectionsRouter.get("/requests", requireAuth, async (req, res) => {
  const meId = req.userId!;

  const rows = (await prisma.connection.findMany({
    where: {
      status: "pending",
      OR: [{ userAId: meId }, { userBId: meId }],
    },
    orderBy: { createdAt: "desc" },
  })) as ConnectionRow[];

  const incoming = rows.filter((row) => row.requestedById !== meId);
  const users = await usersByIds(incoming.map((row) => otherUserId(row, meId)));

  res.json({
    requests: incoming.map((row) => {
      const otherId = otherUserId(row, meId);
      return {
        id: row.id,
        createdAt: row.createdAt,
        user: users.get(otherId) ?? { id: otherId, name: "Unknown user", username: "" },
      };
    }),
  });
});

// ---------------------------------------------------------------------------
// GET /api/connections/requests/sent — pending requests I sent
// ---------------------------------------------------------------------------
connectionsRouter.get("/requests/sent", requireAuth, async (req, res) => {
  const meId = req.userId!;

  const rows = (await prisma.connection.findMany({
    where: { status: "pending", requestedById: meId },
    orderBy: { createdAt: "desc" },
  })) as ConnectionRow[];

  const users = await usersByIds(rows.map((row) => otherUserId(row, meId)));

  res.json({
    requests: rows.map((row) => {
      const otherId = otherUserId(row, meId);
      return {
        id: row.id,
        createdAt: row.createdAt,
        user: users.get(otherId) ?? { id: otherId, name: "Unknown user", username: "" },
      };
    }),
  });
});

// ---------------------------------------------------------------------------
// POST /api/connections — send a connection request
// ---------------------------------------------------------------------------
connectionsRouter.post("/", requireAuth, async (req, res) => {
  const meId = req.userId!;
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input" });
  }

  const targetId = parsed.data.userId;
  if (targetId === meId) {
    return res
      .status(400)
      .json({ message: "You cannot send a connection request to yourself" });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: PUBLIC_USER,
  });
  if (!target) {
    return res.status(404).json({ message: "User not found" });
  }

  // Canonical ordering guarantees one row per pair, whichever way it is sent.
  const [userAId, userBId] =
    meId < targetId ? [meId, targetId] : [targetId, meId];

  const existing = (await prisma.connection.findFirst({
    where: { userAId, userBId },
  })) as ConnectionRow | null;

  if (existing) {
    if (existing.status === "accepted") {
      return res.status(409).json({
        code: "ALREADY_CONNECTED",
        message: "You are already connected with this user",
      });
    }

    if (existing.status === "pending") {
      if (existing.requestedById === meId) {
        return res.status(409).json({
          code: "REQUEST_ALREADY_SENT",
          message: "You have already sent a request to this user",
        });
      }
      return res.status(409).json({
        code: "REQUEST_ALREADY_RECEIVED",
        message:
          "This user has already sent you a request — accept it instead",
      });
    }

    // A previous request was rejected: allow a fresh attempt.
    const reopened = await prisma.connection.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        requestedById: meId,
        createdAt: new Date(),
        respondedAt: null,
      },
    });
    return res.status(201).json({
      connection: {
        id: reopened.id,
        status: reopened.status,
        requestedById: reopened.requestedById,
      },
    });
  }

  const created = await prisma.connection.create({
    data: { userAId, userBId, requestedById: meId, status: "pending" },
  });

  res.status(201).json({
    connection: {
      id: created.id,
      status: created.status,
      requestedById: created.requestedById,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/connections/:id/accept | /reject
// ---------------------------------------------------------------------------
async function findPendingForResponder(
  connectionId: string,
  meId: string
): Promise<
  | { ok: true; connection: ConnectionRow }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const connection = (await prisma.connection.findUnique({
    where: { id: connectionId },
  })) as ConnectionRow | null;

  // Return 404 for rows that don't exist OR don't involve the caller, so the
  // endpoint can't be used to probe other people's connections.
  if (
    !connection ||
    (connection.userAId !== meId && connection.userBId !== meId)
  ) {
    return { ok: false, status: 404, body: { message: "Request not found" } };
  }

  if (connection.status !== "pending") {
    return {
      ok: false,
      status: 400,
      body: { message: "This request is no longer pending" },
    };
  }

  if (connection.requestedById === meId) {
    return {
      ok: false,
      status: 403,
      body: { message: "You cannot respond to your own request" },
    };
  }

  return { ok: true, connection };
}

connectionsRouter.post("/:id/accept", requireAuth, async (req, res) => {
  const meId = req.userId!;
  const found = await findPendingForResponder(String(req.params.id), meId);
  if (!found.ok) return res.status(found.status).json(found.body);

  const updated = await prisma.connection.update({
    where: { id: found.connection.id },
    data: { status: "accepted", respondedAt: new Date() },
  });

  res.json({ connection: { id: updated.id, status: updated.status } });
});

connectionsRouter.post("/:id/reject", requireAuth, async (req, res) => {
  const meId = req.userId!;
  const found = await findPendingForResponder(String(req.params.id), meId);
  if (!found.ok) return res.status(found.status).json(found.body);

  const updated = await prisma.connection.update({
    where: { id: found.connection.id },
    data: { status: "rejected", respondedAt: new Date() },
  });

  res.json({ connection: { id: updated.id, status: updated.status } });
});

// ---------------------------------------------------------------------------
// DELETE /api/connections/:id — cancel a request or remove a connection
// ---------------------------------------------------------------------------
connectionsRouter.delete("/:id", requireAuth, async (req, res) => {
  const meId = req.userId!;

  const connection = (await prisma.connection.findUnique({
    where: { id: String(req.params.id) },
  })) as ConnectionRow | null;

  if (
    !connection ||
    (connection.userAId !== meId && connection.userBId !== meId)
  ) {
    return res.status(404).json({ message: "Connection not found" });
  }

  await prisma.connection.delete({ where: { id: connection.id } });
  res.json({ message: "Connection removed", id: connection.id });
});
