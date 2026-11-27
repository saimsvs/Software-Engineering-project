import { prisma } from "../config/db.js";
import { activitiesSince, withProgress, type ActivityRow } from "../routes/features.js";

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

const TREND_DAYS = 7;

/**
 * Everything one user chooses to show about themselves. Built on the server so
 * private rows never leave the database: callers get only the public projection,
 * not the underlying activity logs, goals or account fields.
 */
export async function buildPublicProfile(userId: string) {
  const [goals, privacy] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, isPublic: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.privacySetting.findUnique({ where: { userId } }),
  ]);

  const publicGoals = goals as GoalRow[];
  let activities: ActivityRow[] = [];
  if (publicGoals.length > 0) {
    const earliest = new Date(Math.min(...publicGoals.map((g) => g.createdAt.getTime())));
    activities = await activitiesSince(userId, earliest);
  }

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (TREND_DAYS - 1));

  const showTrends = privacy?.showTrendsPublic === true;
  const recent = showTrends
    ? ((await prisma.activityLog.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
      })) as ActivityRow[])
    : [];

  return {
    goals: publicGoals.map((goal) => {
      const { id, name, targetValue, targetUnit, category, deadline, progress } = withProgress(goal, activities);
      return { id, name, targetValue, targetUnit, category, deadline, progress };
    }),
    // Challenges are not part of the app yet. Nothing joins this list until a
    // challenge feature exists, so private challenges cannot leak here.
    challenges: [] as { id: string; name: string; joinedAt: string }[],
    trends: showTrends ? trendsFrom(recent, since) : null,
  };
}

function trendsFrom(activities: ActivityRow[], since: Date) {
  const byDay = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i += 1) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + i);
    byDay.set(day.toISOString().slice(0, 10), 0);
  }

  let totalKg = 0;
  for (const activity of activities) {
    const kg = Math.round((activity.emission ?? 0) * 10) / 10;
    totalKg += kg;
    const day = activity.createdAt.toISOString().slice(0, 10);
    byDay.set(day, Math.round(((byDay.get(day) ?? 0) + kg) * 10) / 10);
    const category = activity.category || "Other";
    byCategory.set(category, Math.round(((byCategory.get(category) ?? 0) + kg) * 10) / 10);
  }

  return {
    totalKg: Math.round(totalKg * 10) / 10,
    activityCount: activities.length,
    days: [...byDay.entries()].map(([date, kg]) => ({ date, kg })),
    byCategory: [...byCategory.entries()]
      .map(([category, kg]) => ({ category, kg }))
      .sort((a, b) => b.kg - a.kg),
  };
}
