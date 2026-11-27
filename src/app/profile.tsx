import { apiFetch } from "@/utils/api";
import { resetTo } from "@/utils/nav";
import { clearToken } from "@/utils/storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import type { IconName } from "@/data/activities";
import { Ionicons } from "@expo/vector-icons";
import { UI, cardShadow } from "@/constants/ui";

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const GRAY = "#666";
const RED = "#D32F2F";

export default function ProfileScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("...");
  const [email, setEmail] = useState("...");
  const [username, setUsername] = useState("");
  const [daysActive, setDaysActive] = useState(1);
  const [totalKg, setTotalKg] = useState(0);
  const [activityCount, setActivityCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, actRes] = await Promise.all([
          apiFetch("/api/auth/me"),
          apiFetch("/api/auth/activity"),
        ]);
        if (meRes.ok) {
          const { user } = await meRes.json();
          setUserId(user.id);
          setName(user.name);
          setEmail(user.email);
          setUsername(user.username ?? "");
          const days = Math.max(
            1,
            Math.ceil((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
          );
          setDaysActive(days);
        }
        if (actRes.ok) {
          const { activities } = await actRes.json();
          if (Array.isArray(activities)) {
            setActivityCount(activities.length);
            const sum = activities.reduce((s: number, a: any) => s + a.emission, 0);
            setTotalKg(Math.round(sum * 10) / 10);
          }
        }
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const onLogout = () => {
    const logOut = async () => {
      await clearToken();
      // Drop the app's screens from the history so "back" can't return to them.
      resetTo(router, "/login");
    };
    // Alert.alert has no buttons on web, so use the browser's confirm there.
    if (Platform.OS === "web") {
      if (globalThis.confirm?.("Log out? You'll need to sign in again.")) logOut();
      return;
    }
    Alert.alert("Log out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logOut },
    ]);
  };

  const Row = ({
    icon,
    label,
    value,
    right,
    danger,
    onPress,
  }: {
    icon: IconName;
    label: string;
    value?: string;
    right?: React.ReactNode;
    danger?: boolean;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      disabled={!onPress && !right}
    >
      <Ionicons name={icon} size={18} color={danger ? RED : GRAY} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, danger && { color: RED }]}>{label}</Text>
      {value ? (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{value}</Text>
        </View>
      ) : null}
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Profile" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={GREEN} />
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera-outline" size={14} color={DARK} />
          </View>
        </View>

        <Text style={styles.name}>{name}</Text>
        {!!username && <Text style={styles.username}>@{username}</Text>}
        <Text style={styles.email}>{email}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{daysActive}</Text>
            <Text style={styles.statLabel}>Days Active</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalKg}</Text>
            <Text style={styles.statLabel}>kg CO₂e Saved</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{activityCount}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <Row icon="create-outline" label="Edit Profile" onPress={() => Alert.alert("Edit Profile", "Coming soon")} />
          <Row
            icon="resize-outline"
            label="Units (km / miles)"
            value="km"
            onPress={() => Alert.alert("Units", "Default: km")}
          />
        </View>

        <Text style={styles.sectionTitle}>Sustainability & Community</Text>
        <View style={styles.card}>
          <Row icon="lock-closed-outline" label="Privacy & Location" onPress={() => router.push("/privacy")} />
          <Row icon="flag-outline" label="My Goals" onPress={() => router.push("/goals")} />
          {!!userId && (
            <Row
              icon="eye-outline"
              label="View My Public Profile"
              onPress={() => router.push({ pathname: "/user/[id]", params: { id: userId } })}
            />
          )}
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Row
            icon="download-outline"
            label="Export Data"
            onPress={() => Alert.alert("Export", "Coming soon")}
          />
          <Row icon="log-out-outline" label="Log Out" danger onPress={onLogout} />
        </View>

        <Text style={styles.version}>CarbonTrail v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: UI.bg },

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
    color: DARK,
  },

  content: { paddingHorizontal: 20, paddingBottom: 32, alignItems: "center" },

  avatarWrap: { marginTop: 12, marginBottom: 12 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: LIGHT_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI.card,
    justifyContent: "center",
    alignItems: "center",
    ...cardShadow,
  },

  name: { fontSize: 24, fontWeight: "800", color: DARK, letterSpacing: -0.4 },
  username: { fontSize: 14, fontWeight: "600", color: GREEN, marginTop: 2 },
  email: { fontSize: 14, color: GRAY, marginTop: 2, marginBottom: 18 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24, alignSelf: "stretch" },
  statBox: {
    flex: 1,
    backgroundColor: UI.card,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    ...cardShadow,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: DARK },
  statLabel: { fontSize: 11, color: GRAY, marginTop: 4, textAlign: "center" },

  sectionTitle: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "600",
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },

  card: {
    alignSelf: "stretch",
    backgroundColor: UI.card,
    borderRadius: 16,
    marginBottom: 20,
    ...cardShadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.hairline,
  },
  rowIcon: { width: 28 },
  rowLabel: { flex: 1, fontSize: 15, color: DARK },
  rowBadge: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  rowBadgeText: { fontSize: 11, color: GREEN, fontWeight: "600" },
  chevron: { fontSize: 22, color: "#BBB" },

  version: { fontSize: 12, color: "#BBB", marginTop: 8 },
});
