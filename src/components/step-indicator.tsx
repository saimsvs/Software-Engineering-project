import { StyleSheet, Text, View } from "react-native";

const GREEN = "#2E7D32";

export function StepIndicator({ current, label }: { current: 1 | 2 | 3; label: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {[1, 2, 3].map((s) => {
          const done = s < current;
          const active = s === current;
          const highlighted = done || active;
          return (
            <View key={s} style={styles.stepGroup}>
              <View style={[styles.circle, highlighted && styles.circleActive]}>
                <Text style={[styles.num, highlighted && styles.numActive]}>
                  {done ? "✓" : s}
                </Text>
              </View>
              {s < 3 && <View style={styles.line} />}
            </View>
          );
        })}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 8, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center" },
  stepGroup: { flexDirection: "row", alignItems: "center" },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#CCC",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  circleActive: { backgroundColor: GREEN, borderColor: GREEN },
  num: { fontSize: 13, color: "#999", fontWeight: "600" },
  numActive: { color: "#FFF" },
  line: { width: 56, height: 2, backgroundColor: "#E0E0E0" },
  label: { fontSize: 12, color: "#666", marginTop: 8 },
});
