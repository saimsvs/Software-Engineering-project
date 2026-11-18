import { ScreenHeader } from "@/components/screen-header";
import { UI, cardShadow } from "@/constants/ui";
import { apiFetch } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RED = "#C62828";

export default function PrivacyScreen() {
  const [location, setLocation] = useState(false);
  const [trends, setTrends] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/features/privacy")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setLocation(data.settings.locationSharingEnabled);
        setTrends(data.settings.showTrendsPublic);
      })
      .catch(() => setError("Couldn't load your settings. Nothing has been changed."))
      .finally(() => setLoading(false));
  }, []);

  async function save(nextLocation: boolean, nextTrends: boolean) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/features/privacy", {
        method: "PUT",
        body: JSON.stringify({ locationSharingEnabled: nextLocation, showTrendsPublic: nextTrends }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setLocation(data.settings.locationSharingEnabled);
      setTrends(data.settings.showTrendsPublic);
    } catch {
      setError("Your change wasn't saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScreenHeader title="Privacy" />
      {loading ? (
        <ActivityIndicator color={UI.green} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.title}>Your privacy, your choice</Text>
          <Text style={s.sub}>Both options are off by default. You can change them whenever you like.</Text>

          {!!error && (
            <View style={s.errorBox} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={18} color={RED} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.card}>
            <View style={s.iconWrap}>
              <Ionicons name="location-outline" size={20} color={UI.green} />
            </View>
            <View style={s.text}>
              <Text style={s.label}>Share location data</Text>
              <Text style={s.hint}>
                Allow future opted-in location contributions to area-level carbon statistics. Your exact
                location is never displayed publicly.
              </Text>
            </View>
            <Switch
              value={location}
              disabled={saving}
              onValueChange={(v) => save(v, trends)}
              trackColor={{ true: "#9CCC9F" }}
              thumbColor={location ? UI.green : "#F4F4F4"}
            />
          </View>

          <View style={s.card}>
            <View style={s.iconWrap}>
              <Ionicons name="trending-up-outline" size={20} color={UI.green} />
            </View>
            <View style={s.text}>
              <Text style={s.label}>Show emission trends</Text>
              <Text style={s.hint}>
                Show your estimated-emission trends on your public profile. When off, only you can see your
                trends.
              </Text>
            </View>
            <Switch
              value={trends}
              disabled={saving}
              onValueChange={(v) => save(location, v)}
              trackColor={{ true: "#9CCC9F" }}
              thumbColor={trends ? UI.green : "#F4F4F4"}
            />
          </View>

          <Text style={s.note}>
            Goals and challenges have their own per-item visibility controls. Turning off location sharing
            prevents new location contributions; it does not delete previous contributions.
          </Text>
          {saving && <ActivityIndicator color={UI.green} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: UI.bg },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 24, fontWeight: "800", color: UI.ink, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: UI.muted, lineHeight: 21, marginBottom: 4 },
  card: {
    backgroundColor: UI.card,
    borderRadius: UI.radius,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...cardShadow,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: UI.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  text: { flex: 1 },
  label: { fontSize: 15, fontWeight: "600", color: UI.ink },
  hint: { fontSize: 13, color: UI.muted, lineHeight: 19, marginTop: 4 },
  note: { fontSize: 12, color: "#777", lineHeight: 18, marginTop: 4 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDECEA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { flex: 1, fontSize: 13.5, color: RED },
});
