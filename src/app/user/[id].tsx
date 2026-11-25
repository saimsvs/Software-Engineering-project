import { ScreenHeader } from "@/components/screen-header";
import { UI, cardShadow } from "@/constants/ui";
import { apiFetch } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SharedGoal = {
  id: string;
  name: string;
  targetValue: number;
  targetUnit: string;
  category: string | null;
  deadline: string;
  progress?: { current: number; target: number; percent: number; status: string } | null;
};

type Trend = {
  totalKg: number;
  activityCount: number;
  days: { date: string; kg: number }[];
  byCategory: { category: string; kg: number }[];
};

type PublicProfile = {
  user: { id: string; name: string; username: string };
  goals: SharedGoal[];
  challenges: { id: string; name: string; joinedAt: string }[];
  trends: Trend | null;
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = String(id ?? "");

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}/profile`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Couldn't load this profile.");
        setProfile(null);
        return;
      }
      const data = await res.json();
      setProfile(data.profile);
      setError("");
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const maxKg = profile?.trends
    ? Math.max(1, ...profile.trends.days.map((d) => d.kg))
    : 1;

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScreenHeader title="Public profile" subtitle="Shared with the community" />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={UI.green}
          />
        }
      >
        {loading && <ActivityIndicator color={UI.green} style={s.loading} />}

        {!!error && !loading && (
          <View style={[s.card, s.errorCard]}>
            <Ionicons name="alert-circle-outline" size={20} color="#C62828" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {profile && !loading && (
          <>
            <View style={s.card}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(profile.user.name)}</Text>
              </View>
              <Text style={s.name}>{profile.user.name}</Text>
              {!!profile.user.username && (
                <Text style={s.username}>@{profile.user.username}</Text>
              )}
              <View style={s.shareNote}>
                <Ionicons name="eye-outline" size={14} color={UI.green} />
                <Text style={s.shareNoteText}>Only information shared publicly is shown here.</Text>
              </View>
            </View>

            <Text style={s.sectionTitle}>Public goals</Text>
            {profile.goals.length === 0 ? (
              <View style={s.card}>
                <Text style={s.muted}>This user hasn't shared any goals.</Text>
              </View>
            ) : (
              profile.goals.map((goal) => {
                const p = goal.progress;
                return (
                  <View key={goal.id} style={s.card}>
                    <View style={s.goalTop}>
                      <Ionicons name="flag-outline" size={18} color={UI.green} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.goalName}>{goal.name}</Text>
                        <Text style={s.muted}>
                          {goal.category ? `${goal.category} · ` : ""}
                          Due {goal.deadline.slice(0, 10)}
                        </Text>
                      </View>
                      <View style={s.publicChip}>
                        <Text style={s.publicChipText}>Public</Text>
                      </View>
                    </View>
                    {p ? (
                      <>
                        <View style={s.barTrack}>
                          <View style={[s.barFill, { width: `${Math.min(100, p.percent)}%` }]} />
                        </View>
                        <Text style={s.muted}>
                          {fmt(p.current)} of {fmt(p.target)} {goal.targetUnit} · {p.percent}%
                        </Text>
                      </>
                    ) : (
                      <Text style={s.muted}>
                        Target: {fmt(goal.targetValue)} {goal.targetUnit}
                      </Text>
                    )}
                  </View>
                );
              })
            )}

            <Text style={s.sectionTitle}>Public challenges</Text>
            <View style={s.card}>
              <Ionicons name="trophy-outline" size={20} color={UI.green} />
              <Text style={s.muted}>
                {profile.challenges.length === 0
                  ? "No public challenges to show. Challenges aren't available in the app yet."
                  : profile.challenges.map((c) => c.name).join(", ")}
              </Text>
            </View>

            <Text style={s.sectionTitle}>Estimated-emission trends</Text>
            {profile.trends ? (
              <View style={s.card}>
                <Text style={s.total}>{fmt(profile.trends.totalKg)} kg CO₂e</Text>
                <Text style={s.muted}>
                  Last 7 days · {profile.trends.activityCount} activities
                </Text>
                <View style={s.chart}>
                  {profile.trends.days.map((day) => (
                    <View key={day.date} style={s.chartCol}>
                      <View style={s.chartTrack}>
                        <View
                          style={[
                            s.chartBar,
                            { height: `${Math.max(4, (day.kg / maxKg) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={s.chartLabel}>{day.date.slice(8)}</Text>
                    </View>
                  ))}
                </View>
                {profile.trends.byCategory.length > 0 && (
                  <View style={s.categories}>
                    {profile.trends.byCategory.map((c) => (
                      <View key={c.category} style={s.categoryPill}>
                        <Text style={s.categoryText}>
                          {c.category} · {fmt(c.kg)} kg
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={s.card}>
                <Ionicons name="lock-closed-outline" size={20} color={UI.muted} />
                <Text style={s.muted}>This user keeps their emission trends private.</Text>
              </View>
            )}

            <Text style={s.sectionTitle}>Your sharing settings</Text>
            <View style={s.card}>
              <Text style={s.muted}>
                Control what appears on your own public profile in Privacy settings, and share
                individual goals from My Goals.
              </Text>
              <View style={s.settingsRow}>
                <TouchableOpacity style={s.settingBtn} onPress={() => router.push("/privacy")}>
                  <Text style={s.settingBtnText}>Privacy settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.settingBtn} onPress={() => router.push("/goals")}>
                  <Text style={s.settingBtnText}>My goals</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: UI.bg },
  content: { padding: 20, paddingBottom: 40 },
  loading: { marginTop: 40 },
  card: { backgroundColor: UI.card, borderRadius: UI.radius, padding: 18, marginBottom: 10, ...cardShadow },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10 },
  errorText: { flex: 1, fontSize: 14, color: "#C62828" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: UI.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "800", color: UI.green },
  name: { fontSize: 22, fontWeight: "800", color: UI.ink, textAlign: "center", marginTop: 12 },
  username: { fontSize: 14, color: UI.green, textAlign: "center", marginTop: 2 },
  shareNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  shareNoteText: { fontSize: 12, color: UI.muted },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: UI.ink,
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  muted: { fontSize: 13, color: UI.muted, lineHeight: 19 },
  goalTop: { flexDirection: "row", alignItems: "flex-start" },
  goalName: { fontSize: 15, fontWeight: "700", color: UI.ink },
  publicChip: {
    backgroundColor: UI.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  publicChipText: { fontSize: 11, fontWeight: "700", color: UI.green },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EDF0ED",
    overflow: "hidden",
    marginVertical: 10,
  },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: UI.green },
  total: { fontSize: 24, fontWeight: "800", color: UI.ink },
  chart: { flexDirection: "row", height: 110, marginTop: 16, gap: 6 },
  chartCol: { flex: 1, alignItems: "center" },
  chartTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  chartBar: {
    width: "100%",
    backgroundColor: UI.green,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartLabel: { fontSize: 10, color: UI.muted, marginTop: 4 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  categoryPill: { backgroundColor: UI.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  categoryText: { fontSize: 11, color: UI.greenDark, fontWeight: "600" },
  settingsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  settingBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: UI.green,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  settingBtnText: { color: UI.green, fontSize: 13, fontWeight: "600" },
});
