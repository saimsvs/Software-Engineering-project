import { ACTIVITIES } from "@/data/activities";
import { apiFetch } from "@/utils/api";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const BORDER = "#E0E0E0";
const GRAY = "#666";

type Act = {
  id: string;
  activityId: string;
  category: string;
  emission: number;
  createdAt: string;
};

const CATEGORIES = ["Transport", "Energy", "Food", "Waste"];
const CAT_COLORS: Record<string, string> = {
  Transport: "#2E7D32",
  Energy: "#F9A825",
  Food: "#EF6C00",
  Waste: "#7B1FA2",
};

export default function StatsScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<Act[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/auth/activity?all=1");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.activities)) setActivities(data.activities);
        }
      } catch {
        // show empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return activities.filter((a) => new Date(a.createdAt).getTime() >= weekAgo);
  }, [activities]);

  const totalKg = useMemo(
    () => Math.round(filtered.reduce((s, a) => s + a.emission, 0) * 10) / 10,
    [filtered]
  );

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of CATEGORIES) map[c] = 0;
    for (const a of filtered) map[a.category] = (map[a.category] ?? 0) + a.emission;
    return CATEGORIES.map((c) => ({
      name: c,
      kg: Math.round((map[c] ?? 0) * 10) / 10,
      pct: totalKg > 0 ? Math.round(((map[c] ?? 0) / totalKg) * 100) : 0,
    }));
  }, [filtered, totalKg]);

  const byActivity = useMemo(() => {
    const map: Record<string, { kg: number; count: number }> = {};
    for (const a of filtered) {
      const m = ACTIVITIES.find((x) => x.id === a.activityId);
      const key = m?.name ?? a.activityId;
      if (!map[key]) map[key] = { kg: 0, count: 0 };
      map[key].kg += a.emission;
      map[key].count += 1;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, kg: Math.round(v.kg * 10) / 10, count: v.count }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 5);
  }, [filtered]);

  const maxKg = Math.max(...byActivity.map((x) => x.kg), 0.1);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Statistics" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.rangeLabel}>Last 7 days</Text>

        {loading ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{totalKg}</Text>
                <Text style={styles.summaryLabel}>kg CO₂e total</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{filtered.length}</Text>
                <Text style={styles.summaryLabel}>activities</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>By Category</Text>
            <View style={styles.card}>
              {byCategory.map((c) => (
                <View key={c.name} style={styles.catRow}>
                  <Text style={styles.catName}>{c.name}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${c.pct}%`,
                          backgroundColor: CAT_COLORS[c.name] ?? GREEN,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.catKg}>{c.kg} kg</Text>
                  <Text style={styles.catPct}>{c.pct}%</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Top Emitters</Text>
            {byActivity.length === 0 && (
              <Text style={styles.empty}>No activities in this period</Text>
            )}
            {byActivity.map((a) => (
              <View key={a.name} style={styles.topCard}>
                <View style={styles.topHeader}>
                  <Text style={styles.topName}>{a.name}</Text>
                  <Text style={styles.topKg}>{a.kg} kg</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(a.kg / maxKg) * 100}%`, backgroundColor: GREEN },
                    ]}
                  />
                </View>
                <Text style={styles.topCount}>{a.count}× logged</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  backArrow: { fontSize: 24, color: DARK },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: GREEN,
  },

  content: { paddingHorizontal: 20, paddingBottom: 32 },

  rangeLabel: {
    fontSize: 13,
    color: GRAY,
    marginBottom: 14,
    textAlign: "center",
    fontWeight: "600",
  },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryBox: {
    flex: 1,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
  },
  summaryValue: { fontSize: 28, fontWeight: "bold", color: DARK },
  summaryLabel: { fontSize: 12, color: GRAY, marginTop: 4 },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: DARK, marginBottom: 8, marginTop: 4 },

  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  catRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  catName: { width: 76, fontSize: 13, color: DARK },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F0F0F0",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 5 },
  catKg: { width: 52, fontSize: 12, color: DARK, textAlign: "right" },
  catPct: { width: 34, fontSize: 12, color: GRAY, textAlign: "right" },

  topCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  topHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  topName: { fontSize: 14, fontWeight: "600", color: DARK },
  topKg: { fontSize: 14, fontWeight: "bold", color: GREEN },
  topCount: { fontSize: 11, color: GRAY, marginTop: 6 },

  empty: { fontSize: 13, color: GRAY, textAlign: "center", marginVertical: 12 },
});
