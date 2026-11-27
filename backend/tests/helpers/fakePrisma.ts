/**
 * Minimal in-memory stand-in for the Prisma client.
 *
 * The API routes only touch a small subset of Prisma's query surface, so this
 * fake implements just enough of it to exercise the real Express handlers
 * without needing a live PostgreSQL database. That keeps `npm test` runnable
 * on any machine (and in CI) with no external services.
 */

type Row = Record<string, any>;

function matchesValue(value: any, condition: any): boolean {
  if (condition instanceof Date) return value === condition;
  if (condition && typeof condition === "object" && !Array.isArray(condition)) {
    if ("not" in condition) return value !== condition.not;
    if ("in" in condition) return (condition.in as any[]).includes(value);
    if ("contains" in condition) {
      const haystack = String(value ?? "");
      const needle = String(condition.contains);
      return condition.mode === "insensitive"
        ? haystack.toLowerCase().includes(needle.toLowerCase())
        : haystack.includes(needle);
    }
    if ("equals" in condition) return value === condition.equals;
    if ("gte" in condition) return value >= condition.gte;
    if ("lte" in condition) return value <= condition.lte;
    if ("gt" in condition) return value > condition.gt;
    if ("lt" in condition) return value < condition.lt;
  }
  return value === condition;
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") {
      return (condition as Row[]).some((clause) => matches(row, clause));
    }
    if (key === "AND") {
      return (condition as Row[]).every((clause) => matches(row, clause));
    }
    if (key === "NOT") {
      return !matches(row, condition as Row);
    }
    return matchesValue(row[key], condition);
  });
}

function pick(row: Row, select?: Row): Row {
  if (!select) return { ...row };
  const result: Row = {};
  for (const [key, include] of Object.entries(select)) {
    if (include) result[key] = row[key];
  }
  return result;
}

function sortRows(rows: Row[], orderBy?: Row): Row[] {
  if (!orderBy) return rows;
  const [field, direction] = Object.entries(orderBy)[0] ?? [];
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return direction === "desc" ? -cmp : cmp;
  });
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;

export function createFakePrisma() {
  let seq = 0;
  let users: Row[] = [];
  let codes: Row[] = [];
  let activities: Row[] = [];
  let organizers: Row[] = [];
  let connections: Row[] = [];
  let goals: Row[] = [];
  let privacySettings: Row[] = [];

  const nextId = (prefix: string) => `${prefix}_${++seq}`;
  // Monotonic timestamps keep "order by createdAt" deterministic in tests.
  const now = () => new Date(Date.now() + seq);

  const user = {
    findUnique: async ({ where, select }: any) => {
      const row = users.find((u) => matches(u, where));
      return row ? pick(row, select) : null;
    },
    create: async ({ data, select }: any) => {
      const row: Row = {
        id: nextId("user"),
        emailVerified: false,
        createdAt: now(),
        updatedAt: now(),
        ...data,
      };
      users.push(row);
      return pick(row, select);
    },
    update: async ({ where, data }: any) => {
      const row = users.find((u) => matches(u, where));
      if (!row) throw new Error("User not found");
      Object.assign(row, data, { updatedAt: now() });
      return { ...row };
    },
    findMany: async ({ where, orderBy, take, select }: any = {}) => {
      const found = sortRows(
        users.filter((u) => matches(u, where)),
        orderBy
      );
      return (take ? found.slice(0, take) : found).map((row) => pick(row, select));
    },
  };

  const emailVerificationCode = {
    create: async ({ data }: any) => {
      const row: Row = {
        id: nextId("code"),
        attempts: 0,
        createdAt: now(),
        ...data,
      };
      codes.push(row);
      return { ...row };
    },
    findFirst: async ({ where, orderBy }: any) => {
      const found = sortRows(
        codes.filter((c) => matches(c, where)),
        orderBy
      )[0];
      return found ? { ...found } : null;
    },
    update: async ({ where, data }: any) => {
      const row = codes.find((c) => matches(c, where));
      if (!row) throw new Error("Verification code not found");
      Object.assign(row, data);
      return { ...row };
    },
    delete: async ({ where }: any) => {
      const index = codes.findIndex((c) => matches(c, where));
      if (index === -1) throw new Error("Verification code not found");
      return codes.splice(index, 1)[0];
    },
    deleteMany: async ({ where }: any = {}) => {
      const before = codes.length;
      codes = codes.filter((c) => !matches(c, where));
      return { count: before - codes.length };
    },
    count: async ({ where }: any = {}) =>
      codes.filter((c) => matches(c, where)).length,
  };

  const activityLog = {
    create: async ({ data }: any) => {
      const row: Row = { id: nextId("activity"), createdAt: now(), ...data };
      activities.push(row);
      return { ...row };
    },
    findMany: async ({ where, orderBy, take }: any = {}) => {
      const found = sortRows(
        activities.filter((a) => matches(a, where)),
        orderBy
      );
      return (take ? found.slice(0, take) : found).map((row) => ({ ...row }));
    },
    findFirst: async ({ where }: any) => {
      const found = activities.find((a) => matches(a, where));
      return found ? { ...found } : null;
    },
    update: async ({ where, data }: any) => {
      const row = activities.find((a) => matches(a, where));
      if (!row) throw new Error("Activity not found");
      Object.assign(row, data);
      return { ...row };
    },
    delete: async ({ where }: any) => {
      const index = activities.findIndex((a) => matches(a, where));
      if (index === -1) throw new Error("Activity not found");
      return activities.splice(index, 1)[0];
    },
    count: async ({ where }: any = {}) =>
      activities.filter((a) => matches(a, where)).length,
  };

  const organizer = {
    findUnique: async ({ where }: any) => {
      const row = organizers.find((o) => matches(o, where));
      return row ? { ...row } : null;
    },
  };

  const connection = {
    create: async ({ data }: any) => {
      const row: Row = {
        id: nextId("connection"),
        status: "pending",
        createdAt: now(),
        respondedAt: null,
        ...data,
      };
      connections.push(row);
      return { ...row };
    },
    findUnique: async ({ where }: any) => {
      const row = connections.find((c) => matches(c, where));
      return row ? { ...row } : null;
    },
    findFirst: async ({ where }: any) => {
      const row = connections.find((c) => matches(c, where));
      return row ? { ...row } : null;
    },
    findMany: async ({ where, orderBy, take }: any = {}) => {
      const found = sortRows(
        connections.filter((c) => matches(c, where)),
        orderBy
      );
      return (take ? found.slice(0, take) : found).map((row) => ({ ...row }));
    },
    update: async ({ where, data }: any) => {
      const row = connections.find((c) => matches(c, where));
      if (!row) throw new Error("Connection not found");
      Object.assign(row, data);
      return { ...row };
    },
    delete: async ({ where }: any) => {
      const index = connections.findIndex((c) => matches(c, where));
      if (index === -1) throw new Error("Connection not found");
      return connections.splice(index, 1)[0];
    },
    count: async ({ where }: any = {}) =>
      connections.filter((c) => matches(c, where)).length,
  };

  const goal = {
    create: async ({ data }: any) => {
      const row: Row = {
        id: nextId("goal"),
        isPublic: false,
        category: null,
        createdAt: now(),
        ...data,
      };
      goals.push(row);
      return { ...row };
    },
    findMany: async ({ where, orderBy, take }: any = {}) => {
      const found = sortRows(goals.filter((g) => matches(g, where)), orderBy);
      return (take ? found.slice(0, take) : found).map((row) => ({ ...row }));
    },
    findFirst: async ({ where }: any) => {
      const row = goals.find((g) => matches(g, where));
      return row ? { ...row } : null;
    },
    update: async ({ where, data }: any) => {
      const row = goals.find((g) => matches(g, where));
      if (!row) throw new Error("Goal not found");
      Object.assign(row, data);
      return { ...row };
    },
    deleteMany: async ({ where }: any = {}) => {
      const before = goals.length;
      goals = goals.filter((g) => !matches(g, where));
      return { count: before - goals.length };
    },
  };

  const privacySetting = {
    findUnique: async ({ where }: any) => {
      const row = privacySettings.find((s) => matches(s, where));
      return row ? { ...row } : null;
    },
    upsert: async ({ where, create, update }: any) => {
      const row = privacySettings.find((s) => matches(s, where));
      if (row) {
        Object.assign(row, update, { updatedAt: now() });
        return { ...row };
      }
      const created = { ...create, updatedAt: now() };
      privacySettings.push(created);
      return { ...created };
    },
  };

  return {
    user,
    emailVerificationCode,
    activityLog,
    organizer,
    connection,
    goal,
    privacySetting,

    reset() {
      seq = 0;
      users = [];
      codes = [];
      activities = [];
      organizers = [];
      connections = [];
      goals = [];
      privacySettings = [];
    },

    seed: {
      user(data: Row) {
        const row: Row = {
          id: nextId("user"),
          emailVerified: true,
          createdAt: now(),
          updatedAt: now(),
          ...data,
        };
        users.push(row);
        return { ...row };
      },
      organizer(data: Row) {
        const row: Row = {
          organizerId: nextId("organizer"),
          createdAt: now(),
          ...data,
        };
        organizers.push(row);
        return { ...row };
      },
      activity(data: Row) {
        const row: Row = {
          id: nextId("activity"),
          createdAt: now(),
          ...data,
        };
        activities.push(row);
        return { ...row };
      },
      verificationCode(data: Row) {
        const row: Row = {
          id: nextId("code"),
          attempts: 0,
          createdAt: now(),
          ...data,
        };
        codes.push(row);
        return { ...row };
      },
      connection(data: Row) {
        const row: Row = {
          id: nextId("connection"),
          status: "pending",
          createdAt: now(),
          respondedAt: null,
          ...data,
        };
        connections.push(row);
        return { ...row };
      },
      goal(data: Row) {
        const row: Row = {
          id: nextId("goal"),
          isPublic: false,
          category: null,
          createdAt: now(),
          ...data,
        };
        goals.push(row);
        return { ...row };
      },
      privacySetting(data: Row) {
        const row: Row = {
          locationSharingEnabled: false,
          showTrendsPublic: false,
          updatedAt: now(),
          ...data,
        };
        privacySettings.push(row);
        return { ...row };
      },
    },

    // Escape hatches for assertions.
    _users: () => users,
    _codes: () => codes,
    _activities: () => activities,
    _organizers: () => organizers,
    _connections: () => connections,
    _goals: () => goals,
    _privacySettings: () => privacySettings,
  };
}
