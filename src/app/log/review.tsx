import { StepIndicator } from "@/components/step-indicator";
import { ACTIVITIES, calcEmission } from "@/data/activities";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function ReviewScreen() {
  const router = useRouter();
  const { activity: activityId, distance, unit, note } = useLocalSearchParams<{
    activity: string;
    distance: string;
    unit: string;
    note?: string;
  }>();

  const activity = ACTIVITIES.find((a) => a.id === activityId) ?? ACTIVITIES[0];
  const emission = calcEmission(activity, distance ?? "0", (unit as "km" | "miles") ?? "km");

  const onSave = () => {
    Alert.alert("Saved", "Activity saved to your history.", [
      { text: "OK", onPress: () => router.replace("/home") },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Confirm</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StepIndicator current={3} label="Confirm" />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>{activity.emoji}</Text>
            </View>
            <Text style={styles.activityName}>{activity.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activity.category}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unit}</Text>
            </View>
          </View>

          <Text style={styles.row}>Distance: {distance} km</Text>

          <View style={styles.emissionBox}>
            <Text style={styles.emissionLabel}>ESTIMATED EMISSION</Text>
            <Text style={styles.emissionValue}>{emission} kg CO2e</Text>
            <Text style={styles.emissionMeta}>Factor: {activity.factor} kg CO2e/km</Text>
            <Text style={styles.emissionMeta}>Source: DEFRA 2024</Text>
          </View>

          {!!note && <Text style={styles.note}>Note: {note}</Text>}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>ⓘ  This will be saved to your history</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={onSave}>
          <Text style={styles.saveText}>✓ Save Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 18,
    fontWeight: "bold",
    color: DARK,
  },

  content: { paddingHorizontal: 20, paddingBottom: 24 },

  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  emojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_GREEN,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  emoji: { fontSize: 20 },
  activityName: { flex: 1, fontSize: 16, fontWeight: "bold", color: DARK },
  badge: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  badgeText: { fontSize: 11, color: GREEN, fontWeight: "600" },

  row: { fontSize: 15, color: DARK, marginBottom: 12 },

  emissionBox: { backgroundColor: LIGHT_GREEN, borderRadius: 10, padding: 14 },
  emissionLabel: { fontSize: 11, fontWeight: "700", color: GREEN, letterSpacing: 0.5 },
  emissionValue: { fontSize: 28, fontWeight: "bold", color: DARK, marginTop: 4 },
  emissionMeta: { fontSize: 12, color: GRAY, marginTop: 4 },

  note: { fontSize: 14, color: DARK, marginTop: 12 },

  infoBox: {
    backgroundColor: "#EEF4FF",
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  infoText: { fontSize: 13, color: "#444" },

  footer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  saveText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  editBtn: {
    borderWidth: 1.5,
    borderColor: DARK,
    borderRadius: 10,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  editText: { color: DARK, fontSize: 16, fontWeight: "600" },
});
