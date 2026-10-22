import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const LIGHT_GREEN = "#E8F5E9";
const BORDER = "#E0E0E0";
const GRAY = "#666";

const WEEK = [
  { day: "Mon", h: 40 },
  { day: "Tue", h: 55 },
  { day: "Wed", h: 30 },
  { day: "Thu", h: 62 },
  { day: "Fri", h: 48 },
  { day: "Sat", h: 20 },
  { day: "Sun", h: 70, today: true, value: "4.2" },
];

const RECENT = [
  { emoji: "🚗", name: "Car (Petrol)", time: "Today • 8:30 AM", kg: "19.2 kg" },
  { emoji: "🚌", name: "Bus", time: "Yesterday • 5:15 PM", kg: "2.7 kg" },
  { emoji: "✈️", name: "Flight (Dom.)", time: "Oct 18 • 7:00 AM", kg: "96.4 kg" },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.name}>Saim</Text>
          </View>
          <TouchableOpacity style={styles.avatar} activeOpacity={0.7}>
            <Text style={styles.avatarIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Today's Footprint</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>4.2</Text>
            <Text style={styles.heroUnit}>kg CO₂e</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>↓ 12% vs yesterday</Text>
          </View>
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
          <Text style={styles.link}>See All</Text>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.barsRow}>
            {WEEK.map((b) => (
              <View key={b.day} style={styles.barCol}>
                {b.today && <Text style={styles.barValue}>{b.value}</Text>}
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

        {RECENT.map((a) => (
          <View key={a.name} style={styles.activityRow}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>{a.emoji}</Text>
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityName}>{a.name}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
            <Text style={styles.activityKg}>{a.kg}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },
  content: { paddingHorizontal: 20, paddingBottom: 32 },

  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  greeting: { fontSize: 14, color: GRAY },
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
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
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
});
