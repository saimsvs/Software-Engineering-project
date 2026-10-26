import { StepIndicator } from "@/components/step-indicator";
import { ACTIVITIES, calcEmission } from "@/data/activities";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const BORDER = "#E0E0E0";
const GRAY = "#666";

export default function DetailsScreen() {
  const router = useRouter();
  const { activity: activityId, distance: startDistance, unit: startUnit, note: startNote, editId } =
  useLocalSearchParams<{
    activity: string;
    distance?: string;
    unit?: string;
    note?: string;
    editId?: string;
  }>();
  const activity = ACTIVITIES.find((a) => a.id === activityId) ?? ACTIVITIES[0];
const [distance, setDistance] = useState(startDistance ?? "");
const [unit, setUnit] = useState<string>(
  startUnit ?? (activity.category === "Transport" ? "km" : activity.unit)
);
const [note, setNote] = useState(startNote ?? "");
  const isTransport = activity.category === "Transport";

  const emission = calcEmission(activity, distance, unit);

  const onNext = () => {
    const d = parseFloat(distance);
    if (!d || d <= 0) {
      Alert.alert("Enter a value", isTransport ? "Type how far you travelled." : "Type the amount used.");
      return;
    }
    router.push({
      pathname: "/log/review",
       params: { activity: activity.id, distance, unit, note, ...(editId ? { editId } : {}) },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Activity</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StepIndicator current={2} label="Enter Details" />

        <View style={styles.activityCard}>
          <Text style={styles.activityEmoji}>{activity.emoji}</Text>
          <Text style={styles.activityName}>{activity.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activity.category}</Text>
          </View>
        </View>

        <Text style={styles.label}>{isTransport ? "Distance" : "Amount"}</Text>
        <View style={styles.distanceRow}>
          <TextInput
            style={styles.distanceInput}
            placeholder="0"
            placeholderTextColor="#BBB"
            keyboardType="decimal-pad"
            value={distance}
            onChangeText={setDistance}
          />
          <View style={styles.unitBadge}>
            <Text style={styles.unitBadgeText}>{unit}</Text>
          </View>
        </View>

        <Text style={styles.subLabel}>
          {isTransport ? "How far did you travel?" : `How much did you use? (${activity.unit})`}
        </Text>
        {isTransport && (
          <View style={styles.unitToggle}>
            {(["km", "miles"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.unitPill, unit === u && styles.unitPillActive]}
                onPress={() => setUnit(u)}
              >
                <Text style={[styles.unitPillText, unit === u && styles.unitPillTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.emissionBox}>
          <Text style={styles.emissionLabel}>Estimated Emission</Text>
          <Text style={styles.emissionValue}>{emission} kg CO2e</Text>
          <Text style={styles.emissionMeta}>Factor: {activity.factor} kg CO2e/{activity.unit}</Text>
          <Text style={styles.emissionMeta}>Source: DEFRA 2024</Text>
        </View>

        <Text style={styles.label}>Add a note (optional)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="e.g., commute to university"
          placeholderTextColor="#BBB"
          value={note}
          onChangeText={setNote}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} activeOpacity={0.85} onPress={onNext}>
          <Text style={styles.nextText}>Next: Review</Text>
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
    color: GREEN,
  },

  content: { paddingHorizontal: 20, paddingBottom: 24 },

  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  activityEmoji: { fontSize: 24, marginRight: 10 },
  activityName: { flex: 1, fontSize: 16, fontWeight: "600", color: DARK },
  badge: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, color: GREEN, fontWeight: "600" },

  label: { fontSize: 13, fontWeight: "600", color: DARK, marginBottom: 8 },
  subLabel: { fontSize: 13, color: GRAY, marginTop: 12, marginBottom: 8 },

  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
  },
  distanceInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: "600",
    color: DARK,
    textAlign: "center",
  },
  unitBadge: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unitBadgeText: { fontSize: 14, color: GREEN, fontWeight: "600" },

  unitToggle: { flexDirection: "row", gap: 8 },
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFF",
  },
  unitPillActive: { backgroundColor: GREEN, borderColor: GREEN },
  unitPillText: { fontSize: 13, color: GRAY, fontWeight: "500" },
  unitPillTextActive: { color: "#FFF", fontWeight: "600" },

  emissionBox: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 24,
  },
  emissionLabel: { fontSize: 12, fontWeight: "600", color: GREEN },
  emissionValue: { fontSize: 28, fontWeight: "bold", color: DARK, marginTop: 4 },
  emissionMeta: { fontSize: 12, color: GRAY, marginTop: 4 },

  noteInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: DARK,
    backgroundColor: "#FFF",
  },

  footer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },
  nextBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  nextText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
