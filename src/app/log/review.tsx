import { StepIndicator } from "@/components/step-indicator";
import { ACTIVITIES, calcEmission } from "@/data/activities";
import { apiFetch } from "@/utils/api";
import { enqueue } from "@/utils/offlineQueue";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/screen-header";
import { v4 as uuidv4 } from "uuid";

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const BORDER = "#E0E0E0";
const GRAY = "#666";

export default function ReviewScreen() {
  const router = useRouter();
  const { activity: activityId, distance, unit, note, editId } = useLocalSearchParams<{
    activity: string;
    distance: string;
    unit: string;
    note?: string;
    editId?: string;
  }>();

  const activity = ACTIVITIES.find((a) => a.id === activityId) ?? ACTIVITIES[0];
  const isTransport = activity.category === "Transport";
  const emission = calcEmission(activity, distance ?? "0", unit ?? "km");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);

    const payload = {
      activityId: activity.id,
      category: activity.category,
      distance: parseFloat(distance ?? "0"),
      unit,
      note: note || undefined,
    };

    try {
      const res = await apiFetch(
        editId ? `/api/auth/activity/${editId}` : "/api/auth/activity",
        {
          method: editId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.message || "Could not save activity");
        return;
      }
      Alert.alert(
        editId ? "Updated" : "Saved",
        editId
          ? "Activity updated in your history."
          : "Activity saved to your history.",
        [{ text: "OK", onPress: () => router.replace("/home") }]
      );
    } catch {
      // Network error - save to offline queue
      try {
        await enqueue({
          id: uuidv4(),
          type: editId ? "update" : "create",
          endpoint: editId ? `/api/auth/activity/${editId}` : "/api/auth/activity",
          method: editId ? "PATCH" : "POST",
          payload,
          serverId: editId,
          createdAt: Date.now(),
          retryCount: 0,
          status: "pending",
        });

        Alert.alert(
          "Saved Offline",
          editId
            ? "Update saved locally. It will sync automatically when you're back online."
            : "Activity saved locally. It will sync automatically when you're back online.",
          [{ text: "OK", onPress: () => router.replace("/home") }]
        );
      } catch (queueError) {
        Alert.alert("Error", "Failed to save activity offline");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Review & Confirm" />

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
              <Text style={styles.badgeText}>{isTransport ? unit : activity.unit}</Text>
            </View>
          </View>

          <Text style={styles.row}>
            {isTransport ? `Distance: ${distance} ${unit}` : `Amount: ${distance} ${activity.unit}`}
          </Text>

          <View style={styles.emissionBox}>
            <Text style={styles.emissionLabel}>ESTIMATED EMISSION</Text>
            <Text style={styles.emissionValue}>{emission} kg CO2e</Text>
            <Text style={styles.emissionMeta}>Factor: {activity.factor} kg CO2e/{activity.unit}</Text>
            <Text style={styles.emissionMeta}>Source: DEFRA 2024</Text>
          </View>

          {!!note && <Text style={styles.note}>Note: {note}</Text>}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>ⓘ  This will be saved to your history</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>
            {saving ? "Saving…" : editId ? "✓ Save Changes" : "✓ Save Activity"}
          </Text>
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
