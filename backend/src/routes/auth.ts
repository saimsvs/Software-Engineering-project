import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = jwt.sign({ userId: user.id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  res.status(201).json({ user, token });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input" });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ userId: user.id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});


const activitySchema = z.object({
  activityId: z.string().min(1),
  category: z.string().min(1),
  distance: z.number().positive(),
  unit: z.string().min(1),
  note: z.string().max(500).optional(),
});

const FACTORS: Record<string, number> = {
  // Transport (per km)
  "car-petrol": 0.192,
  "car-electric": 0.05,
  bus: 0.089,
  train: 0.041,
  "flight-dom": 0.255,
  "flight-intl": 0.195,
  motorcycle: 0.113,
  taxi: 0.148,
  // Energy
  electricity: 0.207,
  "natural-gas": 2.04,
  "heating-oil": 2.54,
  // Food
  "beef-meal": 2.7,
  "chicken-meal": 1.4,
  "veggie-meal": 0.7,
  milk: 0.32,
  // Waste
  "general-waste": 0.5,
  "plastic-waste": 1.5,
  "paper-waste": 0.9,
};

// POST /api/auth/activity — save one activity (protected)
router.post("/activity", requireAuth, async (req, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const { activityId, category, distance, unit, note } = parsed.data;
  const factor = FACTORS[activityId];
  if (!factor) {
    return res.status(400).json({ message: "Unknown activity type" });
  }

  const km = unit === "miles" ? distance * 1.60934 : distance;
  const emission = Math.round(km * factor * 10) / 10;

  const activity = await prisma.activityLog.create({
    data: {
      userId: req.userId!,
      activityId,
      category,
      distance,
      unit,
      emission,
      note: note || null,
    },
  });

  res.status(201).json({ activity });
});

// GET /api/auth/activity — user's recent activities (protected)
// ?all=1 → return everything (for stats), otherwise latest 10
router.get("/activity", requireAuth, async (req, res) => {
  const all = req.query.all === "1";
  const activities = await prisma.activityLog.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: all ? 1000 : 10,
  });
  res.json({ activities });
});

// DELETE /api/auth/activity/:id — delete one of MY activities (protected)
router.delete("/activity/:id", requireAuth, async (req, res) => {
  const id = String(req.params.id);

  // security: only delete if the row belongs to this user
  const existing = await prisma.activityLog.findFirst({
    where: { id, userId: req.userId },
  });
  if (!existing) {
    return res.status(404).json({ message: "Activity not found" });
  }

  await prisma.activityLog.delete({ where: { id } });
  res.json({ message: "Deleted", id });
});

export default router;