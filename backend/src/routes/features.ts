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
  const settings = await prisma.privacySetting.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...parsed.data },
    update: parsed.data,
  });
  res.json({ settings });
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

// Fields a user may change after creating a goal. The unit and category are
// fixed: changing them would change what the goal measures. Visibility can be
// toggled so the goal can be shared on (or removed from) a public profile.
const goalUpdateSchema = z.object({
  name: goalSchema.shape.name.optional(),
  targetValue: goalSchema.shape.targetValue.optional(),
  deadline: goalSchema.shape.deadline.optional(),
  isPublic: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

/** End of the given day (UTC) as a Date, or null if it isn't a real future date. */
function parseFutureDeadline(value: string): Date | null {
  const deadline = new Date(`${value}T23:59:59.999Z`);
  if (!Number.isFinite(deadline.getTime())) return null;
  if (deadline.toISOString().slice(0, 10) !== value) return null;
  if (deadline.getTime() <= Date.now()) return null;
  return deadline;
}

export type GoalRow = {
  id: string;
  name: string;
  targetValue: number;
  targetUnit: string;
  category: string | null;
  deadline: Date;
  isPublic: boolean;
  createdAt: Date;
};
export type ActivityRow = { emission: number; createdAt: Date; category: string };

/**
 * Progress is measured from the user's own activity log between the goal's
 * creation and its deadline — only activities in the goal's category, or all
 * of them when the goal has no category:
 *   - "activities": how many activities were logged
 *   - "days": how many different days had at least one activity (UTC dates)
 *   - "kg CO₂e": total emissions logged — an emissions budget to stay within
 */
export function withProgress(goal: GoalRow, activities: ActivityRow[]) {
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

export async function activitiesSince(userId: string, since: Date): Promise<ActivityRow[]> {
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

// PATCH /api/features/goals/:id — edit name, target, deadline or visibility of MY goal
router.patch("/goals/:id", async (req, res) => {
  const parsed = goalUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const unknown = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
    return res.status(400).json({
      message: unknown ? "Only the goal's name, target, deadline and visibility can be changed" : parsed.error.issues[0]?.message ?? "Invalid goal details",
    });
  }

  // Only the owner's goal matches, so other users get 404 (no hint it exists).
  const existing = await prisma.goal.findFirst({ where: { id: String(req.params.id), userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Goal not found" });

  const data: { name?: string; targetValue?: number; deadline?: Date; isPublic?: boolean } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.targetValue !== undefined) data.targetValue = parsed.data.targetValue;
  if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;
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
