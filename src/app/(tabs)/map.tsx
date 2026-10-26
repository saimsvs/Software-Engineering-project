import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DARK = "#1A1A1A";
const GRAY = "#666";

// Placeholder — the aggregated carbon map (Sprint 2) goes here.
export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.emoji}>🗺️</Text>
        <Text style={styles.title}>Carbon Map</Text>
        <Text style={styles.subtitle}>Coming soon — aggregated emissions by area</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "bold", color: DARK },
  subtitle: { fontSize: 14, color: GRAY, marginTop: 6, textAlign: "center" },
});
