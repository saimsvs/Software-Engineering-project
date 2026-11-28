
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


// --------------------------------------------------
// PATCH /api/challenges/:id
// Edit challenge — owning organizer only
// --------------------------------------------------

const editChallengeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).optional(),
    startDate: z.iso.datetime({ offset: true }).optional(),
    endDate: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one field to update"
  );

router.patch("/:id", requireOrganizer, async (req, res) => {
  const challengeId = req.params.id as string;

  // 1. Check whether the challenge exists.
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    return res.status(404).json({
      message: "Challenge not found",
    });
  }

  // 3. Validate the submitted fields.
  const parsed = editChallengeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid challenge update",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  const data = parsed.data;
  const status = challengeStatus(
    challenge.startDate,
    challenge.endDate
  );

  // 4. Completed challenges cannot be edited.
  if (status === "completed") {
    return res.status(409).json({
      message: "Completed challenges cannot be edited",
    });
  }

  // 5. Active challenges allow description changes only.
  if (
    status === "active" &&
    Object.keys(data).some((field) => field !== "description")
  ) {
    return res.status(409).json({
      message:
        "Only the description of an active challenge can be edited",
    });
  }

  // 6. Check dates, including unchanged dates.
  const newStartDate = data.startDate
    ? new Date(data.startDate)
    : challenge.startDate;

  const newEndDate = data.endDate
    ? new Date(data.endDate)
    : challenge.endDate;

  if (newEndDate.getTime() <= newStartDate.getTime()) {
    return res.status(400).json({
      message: "End date must be after start date",
    });
  }

  // 7. Prevent moving an upcoming challenge into the past.
  if (
    status === "upcoming" &&
    newStartDate.getTime() <= Date.now()
  ) {
    return res.status(400).json({
      message: "An upcoming challenge must start in the future",
    });
  }

  // 8. Apply the authorized changes.
  const updated = await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description,
      }),
      ...(data.startDate !== undefined && {
        startDate: newStartDate,
      }),
      ...(data.endDate !== undefined && {
        endDate: newEndDate,
      }),
    },
  });

  return res.json({
    message: "Challenge updated successfully",
    challenge: {
      ...updated,
      status: challengeStatus(
        updated.startDate,
        updated.endDate
      ),
    },
  });
});


// --------------------------------------------------
// DELETE /api/challenges/:id
// Delete an upcoming challenge — owning organizer only
// --------------------------------------------------

router.delete("/:id", requireOrganizer, async (req, res) => {
  const challengeId = req.params.id as string;

  // 1. Find the challenge.
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    return res.status(404).json({
      message: "Challenge not found",
    });
  }

  // 3. Only upcoming challenges can be deleted.
  const status = challengeStatus(
    challenge.startDate,
    challenge.endDate
  );

  if (status !== "upcoming") {
    return res.status(409).json({
      message:
        "Only upcoming challenges can be deleted",
    });
  }

  // 4. Delete only if ownership and date restrictions
  // still hold when the database operation executes.
  const result = await prisma.challenge.deleteMany({
    where: {
      id: challengeId,
      startDate: { gt: new Date() },
    },
  });

  if (result.count === 0) {
    return res.status(409).json({
      message:
        "Challenge could not be deleted because its status changed",
    });
  }

  return res.json({
    message: "Challenge deleted successfully",
  });
});


export default router;
