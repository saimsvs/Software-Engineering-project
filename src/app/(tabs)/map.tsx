import { ScreenHeader } from "@/components/screen-header";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DARK = "#1A1A1A";
const GRAY = "#666";

// Placeholder — the aggregated carbon map (Sprint 2) goes here.
export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Carbon Map"
        subtitle="Aggregated emissions by area"
        showBack={false}
      />
      <View style={styles.center}>
        <Ionicons name="map-outline" size={56} color="#2E7D32" style={styles.icon} />
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.subtitle}>
          See the carbon footprint of your neighbourhood on the map.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7F5" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  icon: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "bold", color: DARK },
  subtitle: { fontSize: 14, color: GRAY, marginTop: 6, textAlign: "center" },
});
