import { Logo } from "@/components/logo";
import { ACTIVITIES, calcEmission, type IconName } from "@/data/activities";
import { Ionicons } from "@expo/vector-icons";
import { TAB_BAR_CLEARANCE, UI, cardShadow } from "@/constants/ui";
import { onSync } from "@/services/offlineSync";
import { PendingOperation } from "@/types/offline";
import { cacheActivities, getCachedActivities } from "@/utils/activityCache";
import { apiFetch } from "@/utils/api";
import { dequeue, getQueue } from "@/utils/offlineQueue";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const GRAY = "#666";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type RecentItem = {
  id: string;
  icon: IconName;
  name: string;
  time: string;
  kg: string;
  activityId: string;
  distance: number;
  unit: string;
  note: string | null;
  createdAtMs: number;
  /** true while the entry is only on this phone and not yet on the server */
  pending?: boolean;
  /** true when the entry has never reached the server (offline create) */
  local?: boolean;
};

type LogEntry = {
  id: string;
  activityId: string;
  distance: number;
  unit: string;
  note: string | null;
  createdAt: string;
  emission: number;
};

type Bar = {
  day: string;
  h: number;
  total: number;
  today: boolean;
};

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Monday 00:00 of the week containing d
function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

function sumDay(entries: LogEntry[], day: Date): number {
  return entries
    .filter((e) => sameDay(new Date(e.createdAt), day))
    .reduce((total, e) => total + e.emission, 0);
}

// One bar per day (Mon–Sun), height scaled to the biggest day of the week
function buildWeek(entries: LogEntry[]): Bar[] {
  const now = new Date();
  const start = startOfWeek(now);
  const totals = DAYS.map((_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return sumDay(entries, day);
  });
  const max = Math.max(...totals);
  const todayIdx = (now.getDay() + 6) % 7; // getDay(): 0=Sun → 6, Mon→0
  return totals.map((total, i) => ({
    day: DAYS[i],
    total,
    h: max > 0 ? Math.max(4, Math.round((total / max) * 70)) : 4,
    today: i === todayIdx,
  }));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return `Today • ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday • ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} • ${time}`;
}

function toRecent(entry: LogEntry, pending = false, local = false): RecentItem {
  const meta = ACTIVITIES.find((x) => x.id === entry.activityId);
  return {
    id: entry.id,
    icon: meta?.icon ?? "leaf-outline",
    name: meta?.name ?? entry.activityId,
    time: formatTime(entry.createdAt),
    kg: `${entry.emission} kg`,
    activityId: entry.activityId,
    distance: entry.distance,
    unit: entry.unit,
    note: entry.note,
    createdAtMs: new Date(entry.createdAt).getTime(),
    pending,
    local,
  };
}

/** Turn a queued offline create into the same shape the server returns. */
function pendingToEntry(op: PendingOperation): LogEntry | null {
  if (!op.payload) return null;
  const meta = ACTIVITIES.find((x) => x.id === op.payload!.activityId);
  if (!meta) return null;
  return {
    id: op.id,
    activityId: op.payload.activityId,
    distance: op.payload.distance,
    unit: op.payload.unit,
    note: op.payload.note ?? null,
    createdAt: new Date(op.createdAt).toISOString(),
    emission: calcEmission(meta, String(op.payload.distance), op.payload.unit),
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [todayKg, setTodayKg] = useState(0);
  const [yesterdayKg, setYesterdayKg] = useState(0);
  const [week, setWeek] = useState<Bar[]>(() => buildWeek([]));

  const loadData = useCallback(async () => {
    let entries: LogEntry[] | null = null;

    try {
      const res = await apiFetch("/api/auth/activity?all=1");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.activities)) {
          entries = data.activities as LogEntry[];
          // Keep a copy on the phone so history survives being offline.
          cacheActivities(entries);
        }
      }
    } catch {
      // Offline — fall back to the cached copy below.
    }

    if (!entries) {
      entries = await getCachedActivities();
    }

    // Anything logged offline lives only in the queue until it syncs, so it
    // has to be merged into the list here (otherwise it looks "lost").
    const queue = await getQueue();
    const pendingCreates = queue
      .filter((op) => op.type === "create")
      .map(pendingToEntry)
      .filter((entry): entry is LogEntry => entry !== null);
    const pendingUpdateIds = new Set(
      queue
        .filter((op) => op.type === "update" && op.serverId)
        .map((op) => op.serverId as string)
    );
    const pendingDeleteIds = new Set(
      queue
        .filter((op) => op.type === "delete" && op.serverId)
        .map((op) => op.serverId as string)
    );

    const combined = [
      ...pendingCreates.map((entry) => toRecent(entry, true, true)),
      ...entries
        .filter((entry) => !pendingDeleteIds.has(entry.id))
        .map((entry) => toRecent(entry, pendingUpdateIds.has(entry.id))),
    ].sort((a, b) => b.createdAtMs - a.createdAtMs);

    setRecent(combined.slice(0, 10));

    // Offline entries count towards the totals straight away.
    const allEntries = [...pendingCreates, ...entries];
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    setTodayKg(sumDay(allEntries, now));
    setYesterdayKg(sumDay(allEntries, yesterday));
    setWeek(buildWeek(allEntries));
  }, []);

  // Reload whenever the screen is shown (e.g. back from saving an activity).
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Refresh as soon as a background sync finishes.
  useEffect(() => onSync(() => loadData()), [loadData]);

  // And when the app comes back to the foreground (network may be back).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") loadData();
    });
    return () => subscription.remove();
  }, [loadData]);

  const onDelete = (item: RecentItem) => {
    // Offline-only entry: it lives in the queue, not on the server.
    if (item.local) {
      Alert.alert(
        "Discard this activity?",
        "It hasn't been uploaded yet, so it will be removed from this phone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: async () => {
              await dequeue(item.id);
              await loadData();
            },
          },
        ]
      );
      return;
    }

    Alert.alert("Delete activity?", `${item.name} • ${item.kg}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await apiFetch(`/api/auth/activity/${item.id}`, {
              method: "DELETE",
            });
            if (res.ok) {
              // Drop any queued edits for this entry as well.
              const queue = await getQueue();
              for (const op of queue.filter((o) => o.serverId === item.id)) {
                await dequeue(op.id);
              }
              await loadData();
            } else {
              Alert.alert("Error", "Could not delete");
            }
          } catch {
            Alert.alert("Error", "Cannot connect to server");
          }
        },
      },
    ]);
  };

const onEdit=(item: RecentItem)=>{
  if (item.local) {
    Alert.alert(
      "Not synced yet",
      "This activity is still on your phone. You can edit it once it has been uploaded."
    );
    return;
  }

  router.push({
    pathname: "/log/activity",
    params: {
      editId: item.id,          // tells every screen "this is an edit"
      activity: item.activityId,
      distance: String(item.distance),
      unit: item.unit,
      note: item.note ?? "",
    },
  });

};

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <View style={styles.brandRow}>
            <Logo size={32} />
            <Text style={styles.brand}>CarbonTrail</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.7}
            onPress={() => router.push("/profile")}
          >
            <Ionicons name="person-outline" size={18} color={DARK} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{"Today's Footprint"}</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{todayKg.toFixed(1)}</Text>
            <Text style={styles.heroUnit}>kg CO₂e</Text>
          </View>
          {yesterdayKg > 0 && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {todayKg <= yesterdayKg ? "↓" : "↑"}{" "}
                {Math.abs(Math.round(((todayKg - yesterdayKg) / yesterdayKg) * 100))}%
                vs yesterday
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => router.push("/log/activity")}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFF" />
          <Text style={styles.ctaText}>Log Activity</Text>
        </TouchableOpacity>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <TouchableOpacity onPress={() => router.push("/stats")}>
            <Text style={styles.link}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.barsRow}>
            {week.map((b) => (
              <View key={b.day} style={styles.barCol}>
                {b.today && <Text style={styles.barValue}>{b.total.toFixed(1)}</Text>}
                <View
                  style={[
                    styles.bar,
                    { height: b.h },
                    b.today && styles.barToday,
                  ]}
                />
                <Text style={styles.barDay}>{b.day}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Activities</Text>

        {recent.length === 0 && (
          <Text style={styles.emptyText}>No activities yet — tap “+ Log Activity”</Text>
        )}
        {recent.map((a) => (
            <TouchableOpacity
    key={a.id}
    style={styles.activityRow}      // styles move onto the touchable
    activeOpacity={0.7}
    onPress={() => onEdit(a)}       // your future edit handler
  >
          <View key={a.id} style={styles.activityInner}>
            <View style={styles.emojiCircle}>
              <Ionicons name={a.icon} size={18} color={GREEN} />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityName}>{a.name}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
              {!!a.note && (
                <View style={styles.noteRow}>
                  <Ionicons name="document-text-outline" size={12} color={GRAY} />
                  <Text style={styles.noteText} numberOfLines={2}>
                    {a.note}
                  </Text>
                </View>
              )}
              {a.pending && (
                <Text style={styles.pendingBadge}>● Pending sync</Text>
              )}
            </View>
            <Text style={styles.activityKg}>{a.kg}</Text>
            
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(a)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color="#999" />
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: UI.bg },
  content: { paddingHorizontal: 20, paddingBottom: TAB_BAR_CLEARANCE },

  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  greeting: { fontSize: 14, color: GRAY },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontSize: 22, fontWeight: "bold", color: GREEN },
  name: { fontSize: 24, fontWeight: "bold", color: DARK, marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI.card,
    justifyContent: "center",
    alignItems: "center",
    ...cardShadow,
  },

  hero: {
    backgroundColor: UI.greenDark,
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },
  heroLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.75)", letterSpacing: 0.3 },
  heroValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  heroValue: { fontSize: 44, fontWeight: "800", color: "#FFF", letterSpacing: -1 },
  heroUnit: { fontSize: 16, color: "rgba(255,255,255,0.75)", marginLeft: 8 },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  pillText: { fontSize: 12, color: GREEN, fontWeight: "600" },

  cta: {
    backgroundColor: GREEN,
    borderRadius: 16,
    height: 54,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
    ...cardShadow,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "600" },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: DARK, marginBottom: 12, letterSpacing: -0.2 },
  link: { fontSize: 13, color: GREEN, fontWeight: "600" },

  chartCard: {
    backgroundColor: UI.card,
    borderRadius: UI.radius,
    padding: 16,
    marginBottom: 28,
    ...cardShadow,
  },
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
  },
  barCol: { alignItems: "center", width: 32 },
  barValue: { fontSize: 10, fontWeight: "600", color: DARK, marginBottom: 4 },
  bar: { width: 16, borderRadius: 4, backgroundColor: "rgba(46,125,50,0.35)" },
  barToday: { backgroundColor: GREEN },
  barDay: { fontSize: 10, color: GRAY, marginTop: 6 },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: UI.card,
    ...cardShadow,
  },
  activityInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  emojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LIGHT_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityName: { fontSize: 15, fontWeight: "600", color: DARK },
  activityTime: { fontSize: 12, color: GRAY, marginTop: 2 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  noteText: { flex: 1, fontSize: 12.5, color: "#4B5563", fontStyle: "italic" },
  pendingBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "#FFF4E5",
    color: "#B26A00",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  activityKg: { fontSize: 14, fontWeight: "bold", color: GREEN },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F3",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  emptyText: { fontSize: 14, color: GRAY, textAlign: "center", marginVertical: 16 },
});
