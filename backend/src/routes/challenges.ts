
import {
  ACTIVITY_IDS,
  ACTIVITY_UNITS,
  CHALLENGE_TARGET_UNITS,
  CHALLENGE_TARGET_DIRECTIONS,
} from "../data/activities.js";

import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

const router = Router();

// --------------------------------------------------
// CHALLENGE VALIDATION
// --------------------------------------------------

const createChallengeSchema = z
  .object({
    name: z.string().trim().min(1).max(120),

    description: z.string().trim().min(1),

    targetValue: z.number().finite().positive(),

    targetUnit: z.enum(CHALLENGE_TARGET_UNITS),

    targetDirection: z.enum(CHALLENGE_TARGET_DIRECTIONS),

    startDate: z.iso.datetime({ offset: true }),

    endDate: z.iso.datetime({ offset: true }),

    activityRules: z
      .object({
        activityIds: z
          .array(z.enum(ACTIVITY_IDS))
          .min(1, "Select at least one activity")
          .refine(
            (ids) => new Set(ids).size === ids.length,
            "Duplicate activities are not allowed"
          ),

        instructions: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // End date must follow the start date.
    if (
      new Date(data.endDate).getTime() <=
      new Date(data.startDate).getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be after start date",
      });
    }

    // Activities and days must have whole-number targets.
    if (
      (data.targetUnit === "activities" ||
        data.targetUnit === "days") &&
      !Number.isInteger(data.targetValue)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["targetValue"],
        message:
          "Activities and days must have whole-number targets",
      });
    }

    // Activities and days work with any supported activity.
    if (
      data.targetUnit === "activities" ||
      data.targetUnit === "days"
    ) {
      return;
    }

    // Quantity-based challenges require compatible units.
    const incompatibleActivities =
      data.activityRules.activityIds.filter(
        (activityId) =>
          ACTIVITY_UNITS[activityId] !== data.targetUnit
      );

    if (incompatibleActivities.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["targetUnit"],
        message:
          `Target unit "${data.targetUnit}" is not compatible ` +
          `with the selected activities: ` +
          incompatibleActivities.join(", "),
      });
    }
  });

// --------------------------------------------------
// ORGANIZER AUTHENTICATION
// --------------------------------------------------

async function requireOrganizer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      header.slice(7),
      env.jwtSecret
    );

    if (
      typeof decoded === "string" ||
      decoded.role !== "organizer" ||
      typeof decoded.userId !== "string"
    ) {
      res.status(403).json({
        message: "Organizer access required",
      });
      return;
    }

    const organizer = await prisma.organizer.findUnique({
      where: {
        organizerId: decoded.userId,
      },
      select: {
        organizerId: true,
      },
    });

    if (!organizer) {
      res.status(403).json({
        message: "Organizer access required",
      });
      return;
    }

    req.userId = organizer.organizerId;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        message: "Invalid or expired token",
      });
      return;
    }

    next(error);
  }
}

// --------------------------------------------------
// CHALLENGE STATUS
// --------------------------------------------------

function challengeStatus(
  startDate: Date,
  endDate: Date
): "upcoming" | "active" | "completed" {
  const now = new Date();

  if (now < startDate) {
    return "upcoming";
  }

  if (now >= endDate) {
    return "completed";
  }

  return "active";
}

// --------------------------------------------------
// POST /api/challenges
// Create challenge — organizers only
// --------------------------------------------------

router.post("/", requireOrganizer, async (req, res) => {
  const parsed = createChallengeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid challenge details",
      fieldErrors:
        z.flattenError(parsed.error).fieldErrors,
    });
  }

  const data = parsed.data;

  const challenge = await prisma.challenge.create({
    data: {
      organizerId: req.userId!,

      name: data.name,
      description: data.description,

      targetValue: data.targetValue,
      targetUnit: data.targetUnit,
      targetDirection: data.targetDirection,

      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),

      activityRules: data.activityRules,
    },
  });

  return res.status(201).json({
    message: "Challenge created successfully",
    challenge: {
      ...challenge,
      status: challengeStatus(
        challenge.startDate,
        challenge.endDate
      ),
    },
  });
});

// --------------------------------------------------
// GET /api/challenges
// List challenges — public
// --------------------------------------------------

router.get("/", async (_req, res) => {
  const challenges = await prisma.challenge.findMany({
    orderBy: {
      startDate: "asc",
    },
  });

  return res.json({
    challenges: challenges.map((challenge) => ({
      ...challenge,
      status: challengeStatus(
        challenge.startDate,
        challenge.endDate
      ),
    })),
  });
});

// --------------------------------------------------
// GET /api/challenges/:id
// Retrieve individual challenge
// --------------------------------------------------

router.get("/:id", async (req, res) => {
  const challenge = await prisma.challenge.findUnique({
    where: {
      id: req.params.id as string,
    },
  });

  if (!challenge) {
    return res.status(404).json({
      message: "Challenge not found",
    });
  }

  return res.json({
    challenge: {
      ...challenge,
      status: challengeStatus(
        challenge.startDate,
        challenge.endDate
      ),
    },
  });
});

export default router;
