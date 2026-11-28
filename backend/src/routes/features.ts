import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
// A valid JWT is not sufficient for organizer accounts to impersonate ordinary users.
router.use(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(403).json({ message: "User account required" });
  next();
});

const privacySchema = z.object({
  locationSharingEnabled: z.boolean(),
  showTrendsPublic: z.boolean(),
}).strict();
router.get("/privacy", async (req, res) => {
  const settings = await prisma.privacySetting.findUnique({ where: { userId: req.userId! } });
  res.json({ settings: settings ?? { locationSharingEnabled: false, showTrendsPublic: false } });
});
router.put("/privacy", async (req, res) => {
  const parsed = privacySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid privacy settings" });
  const [settings] = await prisma.$transaction([
    prisma.privacySetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...parsed.data },
      update: parsed.data,
    }),
    // US21: turning location sharing off removes the user's area from the map
    // straight away, and /location refuses new contributions while it's off.
    ...(parsed.data.locationSharingEnabled
      ? []
      : [prisma.areaContribution.deleteMany({ where: { userId: req.userId! } })]),
  ]);
  res.json({ settings });
});

// ---------------------------------------------------------------------------
// US21 — Contribute location to the Carbon Map
// ---------------------------------------------------------------------------

/** Grid size in degrees. 0.1° is roughly an 11 km square — a district, not a street. */
const AREA_STEP = 0.1;
/** An area appears on the public map only once this many people contribute to it,
 *  so no single person's emissions can be picked out. */
const MIN_PEOPLE_PER_AREA = 3;
/** The map shows emissions from the last 30 days. */
const MAP_WINDOW_DAYS = 30;

/** Snap a coordinate to the centre of its grid cell, e.g. 24.8607 → 24.85. */
function snapToArea(value: number) {
  const cell = Math.floor(value / AREA_STEP);
  return Math.round((cell * AREA_STEP + AREA_STEP / 2) * 100) / 100;
}

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();

// POST /api/features/location — record which area the user is in.
router.post("/location", async (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid location" });

  const settings = await prisma.privacySetting.findUnique({ where: { userId: req.userId! } });
  if (!settings?.locationSharingEnabled) {
    return res.status(403).json({ code: "LOCATION_SHARING_OFF", message: "Turn on location sharing in Privacy first." });
  }

  // The app already sends a rounded position, but snap again here so exact
  // coordinates can never be stored, whatever a client sends.
  const areaLat = snapToArea(parsed.data.latitude);
  const areaLng = snapToArea(parsed.data.longitude);
  const areaKey = `${areaLat}:${areaLng}`;

  await prisma.areaContribution.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, areaKey, areaLat, areaLng },
    update: { areaKey, areaLat, areaLng },
  });
  res.json({ area: { latitude: areaLat, longitude: areaLng, sizeKm: 11 } });
});

// GET /api/features/location — the area the user currently contributes to (only theirs).
router.get("/location", async (req, res) => {
  const row = await prisma.areaContribution.findUnique({ where: { userId: req.userId! } });
  res.json({ area: row ? { latitude: row.areaLat, longitude: row.areaLng, sizeKm: 11, updatedAt: row.updatedAt } : null });
});

// GET /api/features/carbon-map — public, area-level totals. No user ids, names
// or exact positions; areas with fewer than MIN_PEOPLE_PER_AREA people are hidden.
router.get("/carbon-map", async (_req, res) => {
  const since = new Date(Date.now() - MAP_WINDOW_DAYS * 86400000);
  const contributions = await prisma.areaContribution.findMany({
    // Double-check the setting, in case a row outlived a switch-off.
    where: { user: { privacySetting: { locationSharingEnabled: true } } },
    select: { userId: true, areaKey: true, areaLat: true, areaLng: true },
  });
  const emissions = await prisma.activityLog.groupBy({
    by: ["userId"],
    where: { userId: { in: contributions.map((c) => c.userId) }, createdAt: { gte: since } },
    _sum: { emission: true },
  });
  const perUser = new Map(emissions.map((e) => [e.userId, e._sum.emission ?? 0]));

  const areas = new Map<string, { latitude: number; longitude: number; people: number; total: number }>();
  for (const c of contributions) {
    const a = areas.get(c.areaKey) ?? { latitude: c.areaLat, longitude: c.areaLng, people: 0, total: 0 };
    a.people += 1;
    a.total += perUser.get(c.userId) ?? 0;
    areas.set(c.areaKey, a);
  }

  res.json({
    windowDays: MAP_WINDOW_DAYS,
    minPeoplePerArea: MIN_PEOPLE_PER_AREA,
    areas: [...areas.values()]
      .filter((a) => a.people >= MIN_PEOPLE_PER_AREA)
      .map((a) => ({
        latitude: a.latitude,
        longitude: a.longitude,
        people: a.people,
        totalKg: Math.round(a.total * 10) / 10,
        averageKgPerPerson: Math.round((a.total / a.people) * 10) / 10,
      })),
  });
});

const GOAL_UNITS = ["kg CO₂e", "activities", "days"] as const;
// Same categories as the app's activity list (src/data/activities.ts). Every
// logged activity stores its category, so a goal can count just one of them.
const GOAL_CATEGORIES = ["Transport", "Energy", "Food", "Waste"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const goalSchema = z.object({
  name: z.string().trim().min(1, "Give your goal a name").max(120, "Goal name must be 120 characters or fewer"),
  targetValue: z.number().finite().positive("Target must be greater than 0").max(100000000),
  targetUnit: z.enum(GOAL_UNITS),
  // Omitted or null = every activity counts.
  category: z.enum(GOAL_CATEGORIES).nullable().optional(),
  deadline: z.string().regex(DATE_RE, "Use the format YYYY-MM-DD"),
}).strict();

// Fields a user may change after creating a goal. The unit, category and
// visibility are fixed: changing them would change what the goal measures.
const goalUpdateSchema = z.object({
  name: goalSchema.shape.name.optional(),
  targetValue: goalSchema.shape.targetValue.optional(),
  deadline: goalSchema.shape.deadline.optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

/** End of the given day (UTC) as a Date, or null if it isn't a real future date. */
function parseFutureDeadline(value: string): Date | null {
  const deadline = new Date(`${value}T23:59:59.999Z`);
  if (!Number.isFinite(deadline.getTime())) return null;
  if (deadline.toISOString().slice(0, 10) !== value) return null;
  if (deadline.getTime() <= Date.now()) return null;
  return deadline;
}

type GoalRow = {
  id: string;
  name: string;
  targetValue: number;
  targetUnit: string;
  category: string | null;
  deadline: Date;
  isPublic: boolean;
  createdAt: Date;
};
type ActivityRow = { emission: number; createdAt: Date; category: string };

/**
 * Progress is measured from the user's own activity log between the goal's
 * creation and its deadline — only activities in the goal's category, or all
 * of them when the goal has no category:
 *   - "activities": how many activities were logged
 *   - "days": how many different days had at least one activity (UTC dates)
 *   - "kg CO₂e": total emissions logged — an emissions budget to stay within
 */
function withProgress(goal: GoalRow, activities: ActivityRow[]) {
  const now = new Date();
  const inWindow = activities.filter(
    (a) =>
      a.createdAt >= goal.createdAt &&
      a.createdAt <= goal.deadline &&
      (!goal.category || a.category === goal.category)
  );

  let current: number;
  if (goal.targetUnit === "activities") current = inWindow.length;
  else if (goal.targetUnit === "days") {
    current = new Set(inWindow.map((a) => a.createdAt.toISOString().slice(0, 10))).size;
  } else current = Math.round(inWindow.reduce((sum, a) => sum + a.emission, 0) * 100) / 100;

  const ended = now > goal.deadline;
  const isBudget = goal.targetUnit === "kg CO₂e";
  let status: "in_progress" | "achieved" | "missed" | "over_budget";
  if (isBudget) status = current > goal.targetValue ? "over_budget" : ended ? "achieved" : "in_progress";
  else status = current >= goal.targetValue ? "achieved" : ended ? "missed" : "in_progress";

  const daysLeft = ended ? 0 : Math.ceil((goal.deadline.getTime() - now.getTime()) / 86400000);
  return {
    ...goal,
    progress: {
      current,
      target: goal.targetValue,
      percent: Math.min(100, Math.round((current / goal.targetValue) * 100)),
      kind: isBudget ? "budget" : "count",
      status,
      daysLeft,
    },
  };
}

async function activitiesSince(userId: string, since: Date): Promise<ActivityRow[]> {
  return prisma.activityLog.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { emission: true, createdAt: true, category: true },
  });
}

router.post("/goals", async (req, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid goal details", errors: parsed.error.flatten() });
  const deadline = parseFutureDeadline(parsed.data.deadline);
  if (!deadline) return res.status(400).json({ message: "Choose a future deadline" });
  const { name, targetValue, targetUnit, category } = parsed.data;
  const goal = await prisma.goal.create({
    data: { userId: req.userId!, name, targetValue, targetUnit, category: category ?? null, deadline, isPublic: false },
  });
  res.status(201).json({ goal: withProgress(goal, []) });
});

router.get("/goals", async (req, res) => {
  const goals = await prisma.goal.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "desc" } });
  if (goals.length === 0) return res.json({ goals: [] });
  const earliest = new Date(Math.min(...goals.map((g) => g.createdAt.getTime())));
  const activities = await activitiesSince(req.userId!, earliest);
  res.json({ goals: goals.map((g) => withProgress(g, activities)) });
});

// PATCH /api/features/goals/:id — edit name, target and/or deadline of MY goal
router.patch("/goals/:id", async (req, res) => {
  const parsed = goalUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const unknown = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
    return res.status(400).json({
      message: unknown ? "Only the goal's name, target and deadline can be changed" : parsed.error.issues[0]?.message ?? "Invalid goal details",
    });
  }

  // Only the owner's goal matches, so other users get 404 (no hint it exists).
  const existing = await prisma.goal.findFirst({ where: { id: String(req.params.id), userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Goal not found" });

  const data: { name?: string; targetValue?: number; deadline?: Date } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.targetValue !== undefined) data.targetValue = parsed.data.targetValue;
  if (parsed.data.deadline !== undefined) {
    const deadline = parseFutureDeadline(parsed.data.deadline);
    if (!deadline) return res.status(400).json({ message: "Choose a future deadline" });
    data.deadline = deadline;
  }

  const goal = await prisma.goal.update({ where: { id: existing.id }, data });
  res.json({ goal: withProgress(goal, await activitiesSince(req.userId!, goal.createdAt)) });
});

// DELETE /api/features/goals/:id — delete MY goal
router.delete("/goals/:id", async (req, res) => {
  const { count } = await prisma.goal.deleteMany({ where: { id: String(req.params.id), userId: req.userId! } });
  if (count === 0) return res.status(404).json({ message: "Goal not found" });
  res.json({ message: "Goal deleted" });
});


export default router;
