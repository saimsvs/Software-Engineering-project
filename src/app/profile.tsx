import { apiFetch } from "@/utils/api";
import { clearToken } from "@/utils/storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
const RED = "#D32F2F";

export default function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState("...");
  const [email, setEmail] = useState("...");
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
          setName(user.name);
          setEmail(user.email);
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
    Alert.alert("Log out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await clearToken();
          router.replace("/login");
        },
      },
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
    icon: string;
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
      <Text style={styles.rowIcon}>{icon}</Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
        </View>

        <Text style={styles.name}>{name}</Text>
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
          <Row icon="👤" label="Edit Profile" onPress={() => Alert.alert("Edit Profile", "Coming soon")} />
          <Row
            icon="📏"
            label="Units (km / miles)"
            value="km"
            onPress={() => Alert.alert("Units", "Default: km")}
          />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Row
            icon="📊"
            label="Export Data"
            onPress={() => Alert.alert("Export", "Coming soon")}
          />
          <Row icon="🚪" label="Log Out" danger onPress={onLogout} />
        </View>

        <Text style={styles.version}>CarbonTrail v1.0.0</Text>
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
  avatarIcon: { fontSize: 44 },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIcon: { fontSize: 14 },

  name: { fontSize: 22, fontWeight: "bold", color: DARK },
  email: { fontSize: 14, color: GRAY, marginTop: 2, marginBottom: 18 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24, alignSelf: "stretch" },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "bold", color: DARK },
  statLabel: { fontSize: 11, color: GRAY, marginTop: 4, textAlign: "center" },

  sectionTitle: {
    alignSelf: "flex-start",
    fontSize: 13,
    color: GRAY,
    marginBottom: 8,
    marginTop: 4,
  },

  card: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rowIcon: { fontSize: 16, width: 28 },
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
