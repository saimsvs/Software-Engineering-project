import { Logo } from "@/components/logo";
import { ACTIVITIES } from "@/data/activities";
import { apiFetch } from "@/utils/api";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
const BORDER = "#E0E0E0";
const GRAY = "#666";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type RecentItem = {
  id: string;
  emoji: string;
  name: string;
  time: string;
  kg: string;
  activityId: string;   // ← add
  distance: number;     // ← add
  unit: string;         // ← add
  note: string | null;  // ← add
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

export default function HomeScreen() {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [todayKg, setTodayKg] = useState(0);
  const [yesterdayKg, setYesterdayKg] = useState(0);
  const [week, setWeek] = useState<Bar[]>(() => buildWeek([]));

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/activity?all=1");
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.activities)) return;
      const entries: LogEntry[] = data.activities;

      setRecent(
        entries.slice(0, 10).map((a) => {
          const meta = ACTIVITIES.find((x) => x.id === a.activityId);
          return {
            id: a.id,
            emoji: meta?.emoji ?? "🌿",
            name: meta?.name ?? a.activityId,
            time: formatTime(a.createdAt),
            kg: `${a.emission} kg`,
            activityId: a.activityId,   // ← add
      distance: a.distance,       // ← add
      unit: a.unit,               // ← add
      note: a.note, 
          };
        })
      );

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      setTodayKg(sumDay(entries, now));
      setYesterdayKg(sumDay(entries, yesterday));
      setWeek(buildWeek(entries));
    } catch {
      // keep current list on failure
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onDelete = (item: RecentItem) => {
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
              setRecent((prev) => prev.filter((x) => x.id !== item.id));
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
            <Text style={styles.avatarIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Today's Footprint</Text>
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
          <Text style={styles.ctaText}>+   Log Activity</Text>
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
              <Text style={styles.emoji}>{a.emoji}</Text>
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityName}>{a.name}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
            <Text style={styles.activityKg}>{a.kg}</Text>
            
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(a)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },
  content: { paddingHorizontal: 20, paddingBottom: 110 },

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
    backgroundColor: LIGHT_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarIcon: { fontSize: 18 },

  hero: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: { fontSize: 13, fontWeight: "600", color: GREEN },
  heroValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  heroValue: { fontSize: 40, fontWeight: "bold", color: DARK },
  heroUnit: { fontSize: 16, color: GRAY, marginLeft: 8 },
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
    borderRadius: 10,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "600" },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: DARK, marginBottom: 12 },
  link: { fontSize: 13, color: GREEN, fontWeight: "600" },

  chartCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
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
    borderWidth: 1,
    borderColor: "#EFEFEF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  emoji: { fontSize: 16 },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityName: { fontSize: 15, fontWeight: "600", color: DARK },
  activityTime: { fontSize: 12, color: GRAY, marginTop: 2 },
  activityKg: { fontSize: 14, fontWeight: "bold", color: GREEN },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  deleteIcon: { fontSize: 12, color: "#999" },
  emptyText: { fontSize: 14, color: GRAY, textAlign: "center", marginVertical: 16 },
});
