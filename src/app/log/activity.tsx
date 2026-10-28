import { StepIndicator } from "@/components/step-indicator";
import { ACTIVITIES } from "@/data/activities";
import { useRouter, useLocalSearchParams } from "expo-router";
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


const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const BORDER = "#E0E0E0";
const GRAY = "#666";

const CATEGORIES = ["Transport", "Energy", "Food", "Waste"] as const;

export default function ActivityScreen() {
  const router = useRouter();const { editId, activity: activityId } = useLocalSearchParams<{
  editId?: string;
  activity?: string;
}>();const incoming = activityId
  ? ACTIVITIES.find((a) => a.id === activityId)
  : undefined;

const [category, setCategory] = useState<string>(incoming?.category ?? "Transport");
const [selected, setSelected] = useState<string | null>(incoming?.id ?? null);


  const list = ACTIVITIES.filter((a) => a.category === category);

  const onNext = () => {
    if (!selected) {
      Alert.alert("Choose an activity", "Tap an activity card to select it.");
      return;
    }
    router.push({ pathname: "/log/details", params: { activity: selected, ...(editId ? { editId } : {}) }});
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
        <StepIndicator current={1} label="Choose Activity" />

        <View style={styles.tabsRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.tab, category === c && styles.tabActive]}
              onPress={() => {
                setCategory(c);
                setSelected(null);
              }}
            >
              <Text style={[styles.tabText, category === c && styles.tabTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {list.length === 0 ? (
          <Text style={styles.emptyText}>No activities in this category yet.</Text>
        ) : (
          <View style={styles.grid}>
            {list.map((a) => {
              const isSelected = selected === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  activeOpacity={0.8}
                  onPress={() => setSelected(a.id)}
                >
                  {isSelected && <Text style={styles.check}>✓</Text>}
                  <Text style={styles.cardEmoji}>{a.emoji}</Text>
                  <Text style={styles.cardName}>{a.name}</Text>
                  <Text style={styles.cardUnit}>{a.unit}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} activeOpacity={0.85} onPress={onNext}>
          <Text style={styles.nextText}>Next: Details</Text>
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

  tabsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  tabActive: { backgroundColor: GREEN, borderColor: GREEN },
  tabText: { fontSize: 13, color: DARK, fontWeight: "500" },
  tabTextActive: { color: "#FFF", fontWeight: "600" },

  emptyText: { textAlign: "center", color: GRAY, marginTop: 40, fontSize: 14 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  card: {
    width: "48%",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  cardSelected: { borderColor: GREEN, backgroundColor: LIGHT_GREEN },
  check: {
    position: "absolute",
    top: 8,
    right: 10,
    fontSize: 14,
    color: GREEN,
    fontWeight: "bold",
  },
  cardEmoji: { fontSize: 34, marginBottom: 8 },
  cardName: { fontSize: 14, fontWeight: "600", color: DARK, textAlign: "center" },
  cardUnit: { fontSize: 12, color: GRAY, marginTop: 4 },

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
