# Activity Saving — How It Works (Learn & Change Guide)

> Sprint 2 feature: when a user finishes the Log Activity wizard and taps
> **Save Activity**, the entry is stored in PostgreSQL (Render) and shown
> later on the Home screen.

---

## 1. Big Picture

```
📱 App (Step 3: Review)                     ☁️ Render                    🗄️ Render DB
───────────────────────                     ────────                     ────────────
User taps "Save Activity"
  │
  ├─ reads token from phone storage
  │
  └─ POST /api/activity ────────────────▶  requireAuth middleware
     Header: Authorization: Bearer eyJ..      │ verifies JWT
                                              ▼
                                            auth handler
                                              │ validates body (Zod)
                                              │ computes emission (factor × distance)
                                              ▼
                                            prisma.activityLog.create() ──▶ INSERT INTO "ActivityLog"
                                              ◀── saved row ────────────────
  ◀── { activity: {...} } ───────────────────
  │
  └─ navigate back to Home
       Home fetches GET /api/activity ───▶ SELECT * FROM "ActivityLog"
                                            ◀── user's recent rows ─────────
```

**Golden rule:** the client sends *what happened* (activity, distance, unit);
the **server calculates** the emission. Never trust numbers computed only on
the phone — anyone can modify an app.

---

## 2. What Already Exists (prerequisites)

| Piece | File | Status |
|-------|------|--------|
| Users table | `backend/prisma/schema.prisma` | ✅ |
| Register / Login | `backend/src/routes/auth.ts` | ✅ |
| JWT issued on login | same file, `jwt.sign(...)` | ✅ |
| Token verification middleware | `backend/src/middleware/auth.ts` | ✅ |
| `GET /api/auth/me` (protected) | `backend/src/routes/auth.ts` | ✅ |
| 3-step wizard UI | `src/app/log/activity.tsx`, `details.tsx`, `review.tsx` | ✅ |
| Emission factors (client) | `src/data/activities.ts` | ✅ |
| **ActivityLog table** | — | ❌ Step 1 |
| **POST /api/activity** | — | ❌ Step 2 |
| **GET /api/activity** | — | ❌ Step 3 |
| **Token storage on phone** | — | ❌ Step 4 |
| **fetch helper with auth header** | — | ❌ Step 5 |
| **Wire Save button** | `src/app/log/review.tsx` | ❌ Step 6 |
| **Wire Home list** | `src/app/(tabs)/home.tsx` | ❌ Step 7 |

---

## 3. Step-by-Step

### Step 1 — Database table (Prisma schema)

**File:** `backend/prisma/schema.prisma`

Add a relation on `User` and a new model:

```prisma
model User {
  id           String        @id @default(cuid())
  name         String
  email        String        @unique
  passwordHash String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  activityLogs ActivityLog[] // ← add this line
}

model ActivityLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  activityId String   // "car-petrol", "bus", ... (same ids as src/data/activities.ts)
  category   String   // "Transport" (display only)
  distance   Float    // 100
  unit       String   // "km" | "miles"
  emission   Float    // 19.2  (kg CO2e, computed by SERVER)
  note       String?  // optional text
  createdAt  DateTime @default(now())

  @@index([userId]) // fast "get activities for this user"
}
```

**Apply it** (your laptop's `.env` points at the Render DB, so this creates
the table in the cloud):

```bash
cd backend
npx prisma migrate dev --name add_activity_logs
```

**Where to change later:** want extra fields (photo? location?) → add column
here + `migrate dev` again.

---

### Step 2 — `POST /api/activity` (save one entry)

**File:** `backend/src/routes/auth.ts` (or create `backend/src/routes/activity.ts`)

```typescript
const activitySchema = z.object({
  activityId: z.string().min(1),
  category: z.string().min(1),
  distance: z.number().positive(),
  unit: z.enum(["km", "miles"]),
  note: z.string().max(500).optional(),
});

// Server-side factors — single source of truth (keep in sync with src/data/activities.ts)
const FACTORS: Record<string, number> = {
  "car-petrol": 0.192,
  "car-electric": 0.05,
  bus: 0.089,
  train: 0.041,
  "flight-dom": 0.255,
  "flight-intl": 0.195,
  motorcycle: 0.113,
  taxi: 0.148,
};

router.post("/activity", requireAuth, async (req, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const { activityId, category, distance, unit, note } = parsed.data;
  const factor = FACTORS[activityId];
  if (!factor) return res.status(400).json({ message: "Unknown activity type" });

  const km = unit === "miles" ? distance * 1.60934 : distance;
  const emission = Math.round(km * factor * 10) / 10;

  const activity = await prisma.activityLog.create({
    data: {
      userId: req.userId!,   // ← from the verified JWT, NOT from the request body
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
```

Key ideas:
- `requireAuth` guarantees `req.userId` exists → **users can only save as themselves**
- `FACTORS[activityId]` rejects unknown types
- Emission computed here, not trusted from the phone

---

### Step 3 — `GET /api/activity` (fetch history)

```typescript
router.get("/activity", requireAuth, async (req, res) => {
  const activities = await prisma.activityLog.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  res.json({ activities });
});
```

---

### Step 4 — Store the token on the phone

Without this, the app forgets who the user is on every cold start.

```bash
npx expo install @react-native-async-storage/async-storage
```

**New file:** `src/utils/storage.ts`

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "carbontrail_token";

export async function saveToken(token: string) {
  await AsyncStorage.setItem(KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(KEY);
}
```

Then in `login.tsx` + `register.tsx`, after a successful response:

```typescript
await saveToken(data.token);   // before router.replace("/home")
```

> **Learn more:** `AsyncStorage` = simple key–value storage on the phone
> (like localStorage in a browser). Production apps often prefer
> `expo-secure-store` (encrypted). Fine either way for this course.

---

### Step 5 — fetch helper that attaches the token

**New file:** `src/utils/api.ts`

```typescript
import { API_URL } from "@/config/api";
import { getToken } from "./storage";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
```

Now every call is one line:

```typescript
const data = await apiFetch("/api/activity", {
  method: "POST",
  body: JSON.stringify({ activityId, category, distance, unit, note }),
});
```

---

### Step 6 — Wire the Save button

**File:** `src/app/log/review.tsx` — replace the fake alert:

```typescript
const [saving, setSaving] = useState(false);

const onSave = async () => {
  if (saving) return;
  setSaving(true);
  try {
    await apiFetch("/api/activity", {
      method: "POST",
      body: JSON.stringify({
        activityId: activity.id,
        category: activity.category,
        distance: parseFloat(distance),
        unit: unit ?? "km",
        note: note || undefined,
      }),
    });
    Alert.alert("Saved", "Activity saved to your history.", [
      { text: "OK", onPress: () => router.replace("/home") },
    ]);
  } catch (e: any) {
    Alert.alert("Error", e.message);
  } finally {
    setSaving(false);
  }
};
```

---

### Step 7 — Home screen reads real data

**File:** `src/app/(tabs)/home.tsx` — replace the hardcoded `RECENT` array:

```typescript
const [recent, setRecent] = useState<typeof RECENT>([]);

useEffect(() => {
  apiFetch("/api/activity")
    .then((d) =>
      setRecent(
        d.activities.map((a: any) => ({
          emoji: ACTIVITIES.find((x) => x.id === a.activityId)?.emoji ?? "🌱",
          name: ACTIVITIES.find((x) => x.id === a.activityId)?.name ?? a.activityId,
          time: new Date(a.createdAt).toLocaleString(),
          kg: `${a.emission} kg`,
        })),
      ),
    )
    .catch(() => {}); // keep empty list on failure
}, []);
```

> Wireframe shows `Car (Petrol)` / `Today • 8:30 AM` — map `createdAt` to a
> friendly time format when you polish.

---

## 4. How to Test

### Backend only (curl):

```bash
cd backend && npm run dev          # terminal 1

# 1. login → token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@test.com","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2. save an activity
curl -X POST http://localhost:3000/api/auth/activity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"activityId":"car-petrol","category":"Transport","distance":100,"unit":"km","note":"uni commute"}'

# 3. fetch history
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/activity

# 4. without token → must fail 401
curl http://localhost:3000/api/auth/activity
```

> Routes are mounted under `/api/auth` because everything lives in
> `backend/src/routes/auth.ts`. If you split into `routes/activity.ts`,
> mount it: `app.use("/api", activityRoutes)` → paths become `/api/activity`.

### Full app flow:

```
npx expo start -i -c
Login → Home → + Log Activity → Car (Petrol) → 100 km → Save
→ Home "Recent Activities" should show "19.2 kg"
```

---

## 5. Where to Change What

| I want to... | Edit this |
|--------------|-----------|
| Add/rename an activity | `src/data/activities.ts` **and** `FACTORS` in `auth.ts` (keep in sync!) |
| Change emission math | `FACTORS` + `calcEmission()` (client shows preview only; server wins) |
| Add a field (e.g. photo) | `schema.prisma` → `migrate dev` → Zod schema → create data |
| Change how many rows Home shows | `take: 10` in GET endpoint |
| Use a separate `activity.ts` route file | see note in §4 |
| Logout (forget token) | `clearToken()` then `router.replace("/login")` |
| Auto-redirect if token missing | in `(app)` or root layout: `getToken()` → if null → `/login` |

---

## 6. Security Checklist (why it's built this way)

- ✅ Emission computed **server-side** (client can't fake a lower footprint)
- ✅ `userId` comes from **verified JWT**, not request body (can't save for others)
- ✅ Zod validation rejects garbage before touching the DB
- ✅ Token stored only on phone + sent as `Authorization: Bearer`
- ⚠️ Still missing (nice-to-have): rate limiting, token refresh, `expo-secure-store`

---

## 7. File Map (after all steps)

```
backend/
  prisma/schema.prisma        ← ActivityLog model  (Step 1)
  src/routes/auth.ts          ← POST/GET activity  (Steps 2-3)
  src/middleware/auth.ts      ← requireAuth        (exists)

src/
  data/activities.ts          ← factors for UI preview (exists)
  utils/storage.ts            ← save/get token     (Step 4) NEW
  utils/api.ts                ← fetch + Bearer     (Step 5) NEW
  app/(auth)/login.tsx        ← saveToken()        (Step 4)
  app/(auth)/register.tsx     ← saveToken()        (Step 4)
  app/log/review.tsx          ← real POST          (Step 6)
  app/(tabs)/home.tsx         ← real GET list      (Step 7)
```
