import { ScreenHeader } from "@/components/screen-header";
import { UI, cardShadow } from "@/constants/ui";
import { apiFetch } from "@/utils/api";
import { askLocationPermission, contributeArea, formatArea, type Area } from "@/utils/area-location";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RED = "#C62828";

export default function PrivacyScreen() {
  const [location, setLocation] = useState(false);
  const [trends, setTrends] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // US21: the map area this user contributes to (a ~11 km square), if any.
  const [area, setArea] = useState<Area | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch("/api/features/privacy"), apiFetch("/api/features/location")])
      .then(async ([privacyRes, locationRes]) => {
        if (!privacyRes.ok) throw new Error();
        const data = await privacyRes.json();
        setLocation(data.settings.locationSharingEnabled);
        setTrends(data.settings.showTrendsPublic);
        if (locationRes.ok) setArea((await locationRes.json()).area);
      })
      .catch(() => setError("Couldn't load your settings. Nothing has been changed."))
      .finally(() => setLoading(false));
  }, []);

  /** Read the phone's rough position and send its map area (never the exact spot). */
  async function updateArea() {
    setLocating(true);
    setError("");
    try {
      setArea(await contributeArea());
    } catch (e) {
      setError(
        e instanceof Error && e.message === "PERMISSION"
          ? "CarbonTrail can't use your location. Allow it in your phone's Settings, then tap Update my area."
          : "Couldn't get your area right now. Tap Update my area to try again."
      );
    } finally {
      setLocating(false);
    }
  }

  async function toggleLocation(next: boolean) {
    setError("");
    if (next) {
      // 1. Ask the phone for permission first. Without it, sharing stays off.
      if (!(await askLocationPermission())) {
        setError("Location permission wasn't given, so location sharing is still off. You can allow it in your phone's Settings.");
        return;
      }
      // 2. Save the setting, 3. then send this user's area.
      if (await save(true, trends)) await updateArea();
    } else if (await save(false, trends)) {
      setArea(null); // the server also removes the user's area from the map
    }
  }

  async function save(nextLocation: boolean, nextTrends: boolean): Promise<boolean> {
    if (saving) return false;
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
      return true;
    } catch {
      setError("Your change wasn't saved. Check your connection and try again.");
      return false;
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
              <Text style={s.label}>Contribute to the Carbon Map</Text>
              <Text style={s.hint}>
                Add your estimated emissions to your area on the public Carbon Map. Only a rough area
                (about 11 km across) is saved, never your exact location, and areas with fewer than 3
                people aren&apos;t shown.
              </Text>
              {location && (
                <View style={s.areaBox}>
                  {locating ? (
                    <Text style={s.areaText}>Finding your area…</Text>
                  ) : area ? (
                    <Text style={s.areaText}>
                      Contributing to the area around <Text style={s.areaStrong}>{formatArea(area)}</Text>
                    </Text>
                  ) : (
                    <Text style={s.areaText}>Not contributing yet.</Text>
                  )}
                  <Pressable
                    onPress={updateArea}
                    disabled={locating}
                    style={({ pressed }) => [s.areaBtn, (pressed || locating) && { opacity: 0.6 }]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh" size={14} color={UI.green} />
                    <Text style={s.areaBtnText}>Update my area</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <Switch
              value={location}
              disabled={saving || locating}
              onValueChange={toggleLocation}
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
              onValueChange={(v) => void save(location, v)}
              trackColor={{ true: "#9CCC9F" }}
              thumbColor={trends ? UI.green : "#F4F4F4"}
            />
          </View>

          <Text style={s.note}>
            Goals and challenges have their own per-item visibility controls. Turning off Carbon Map
            sharing stops new contributions and removes your area from the map straight away.
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
  areaBox: { marginTop: 10, backgroundColor: UI.greenSoft, borderRadius: 10, padding: 10, gap: 8 },
  areaText: { fontSize: 13, color: UI.ink, lineHeight: 18 },
  areaStrong: { fontWeight: "700" },
  areaBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  areaBtnText: { fontSize: 13, fontWeight: "600", color: UI.green },
});
