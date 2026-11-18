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

const goalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetValue: z.number().finite().positive().max(100000000),
  targetUnit: z.enum(["kg CO₂e", "activities", "days"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();
router.post("/goals", async (req, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid goal details", errors: parsed.error.flatten() });
  const deadline = new Date(`${parsed.data.deadline}T23:59:59.999Z`);
  if (!Number.isFinite(deadline.getTime()) || deadline.toISOString().slice(0, 10) !== parsed.data.deadline || deadline.getTime() <= Date.now()) {
    return res.status(400).json({ message: "Choose a future deadline" });
  }
  const { name, targetValue, targetUnit } = parsed.data;
  const goal = await prisma.goal.create({
    data: { userId: req.userId!, name, targetValue, targetUnit, deadline, isPublic: false },
  });
  res.status(201).json({ goal });
});
router.get("/goals", async (req, res) => {
  const goals = await prisma.goal.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "desc" } });
  res.json({ goals });
});


export default router;
