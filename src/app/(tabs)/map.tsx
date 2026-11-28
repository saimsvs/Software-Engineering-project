import CarbonMapView from "@/components/carbon-map-view";
import { UI, cardShadow } from "@/constants/ui";
import { apiFetch } from "@/utils/api";
import { LEVELS, areaKey, formatCoords, levelFor, type MapArea } from "@/utils/carbon-map";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * US22 — View Aggregated Carbon Map.
 *
 * Layout (like a maps app): the map fills the whole screen; one floating card at
 * the top holds the title and colour key; one floating panel at the bottom
 * (just above the tab bar) shows either a summary, the tapped area's details,
 * or the empty state. The ⓘ button opens "How this map works", which also
 * carries the OpenStreetMap credit.
 */

type MapData = { windowDays: number; minPeoplePerArea: number; areaStep: number; areas: MapArea[] };

/** The floating tab bar is ~52px tall and sits 10px above the bottom edge. */
const ABOVE_TAB_BAR = 74;

export default function MapScreen() {
  const router = useRouter();
  const [data, setData] = useState<MapData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  // Bumped by the "show all areas" button; the map re-zooms when it changes.
  const [recenter, setRecenter] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/features/carbon-map");
      if (!res.ok) throw new Error();
      setData(await res.json());
      setStatus("ready");
    } catch {
      setStatus((s) => (s === "ready" ? s : "error")); // keep showing old data if a refresh fails
    }
  }, []);

  // Reload whenever the tab is opened, e.g. after turning on sharing in Privacy.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const select = useCallback(async (key: string | null) => {
    setSelectedKey(key);
    if (key) setShowInfo(false);
  }, []);

  const selected = data?.areas.find((a) => areaKey(a) === selectedKey) ?? null;
  const level = selected ? levelFor(selected.averageKgPerPerson) : null;

  // ----- No data yet: loading / error take the whole screen -----
  if (!data) {
    return (
      <View style={s.screen}>
        <TopCard onInfo={() => setShowInfo((v) => !v)} />
        <View style={s.center}>
          {status === "error" ? (
            <>
              <View style={s.stateIcon}>
                <Ionicons name="cloud-offline-outline" size={28} color={UI.green} />
              </View>
              <Text style={s.stateTitle}>Couldn&apos;t load the map</Text>
              <Text style={s.stateText}>The Carbon Map needs an internet connection.</Text>
              <Pressable onPress={load} style={({ pressed }) => [s.primaryBtn, s.stateBtn, pressed && s.pressed]}>
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={s.primaryBtnText}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={UI.green} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {/* The map fills the screen; everything else floats on top of it. */}
      <CarbonMapView
        areas={data.areas}
        areaStep={data.areaStep}
        selectedKey={selectedKey}
        onSelect={select}
        recenter={recenter}
        dom={{ style: { flex: 1 }, scrollEnabled: false }}
      />

      <TopCard onInfo={() => setShowInfo((v) => !v)} infoOpen={showInfo} windowDays={data.windowDays} />

      {showInfo && (
        <View style={[s.card, s.info]}>
          <Text style={s.infoTitle}>How this map works</Text>
          <InfoRow icon="grid-outline" text={`Each circle is an area about ${Math.round(data.areaStep * 111)} km wide.`} />
          <InfoRow
            icon="people-outline"
            text={`Areas appear only when at least ${data.minPeoplePerArea} people share their location there.`}
          />
          <InfoRow icon="eye-off-outline" text="No individual users or exact locations are ever shown." />
          <InfoRow
            icon="calculator-outline"
            text={`Values are estimated CO₂e from activities logged in the last ${data.windowDays} days.`}
          />
          <Text style={s.credit}>Map data © OpenStreetMap contributors</Text>
        </View>
      )}

      {/* Bottom panel, just above the tab bar. */}
      <View style={[s.card, s.panel]}>
        {data.areas.length === 0 ? (
          <>
            <View style={s.row}>
              <View style={s.iconBubble}>
                <Ionicons name="map-outline" size={18} color={UI.green} />
              </View>
              <View style={s.flex}>
                <Text style={s.panelTitle}>No areas to show yet</Text>
                <Text style={s.panelSub}>
                  An area appears once {data.minPeoplePerArea} or more people share their location there.
                </Text>
              </View>
            </View>
            <Pressable onPress={() => router.push("/privacy")} style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}>
              <Text style={s.primaryBtnText}>Share my area</Text>
            </Pressable>
          </>
        ) : selected && level ? (
          <>
            <View style={s.row}>
              <View style={[s.levelDot, { backgroundColor: level.color }]} />
              <View style={s.flex}>
                <Text style={s.panelTitle}>Area near {formatCoords(selected)}</Text>
                <Text style={s.panelSub}>
                  {level.label} emissions · about {Math.round(data.areaStep * 111)} km wide
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedKey(null)}
                hitSlop={10}
                style={s.closeBtn}
                accessibilityLabel="Close area details"
              >
                <Ionicons name="close" size={16} color={UI.muted} />
              </Pressable>
            </View>
            <View style={s.stats}>
              <Stat value={selected.averageKgPerPerson} unit="kg" label="Avg per person" accent={level.color} />
              <Stat value={selected.totalKg} unit="kg" label="Area total" />
              <Stat value={selected.people} label="People" />
            </View>
            <Text style={s.footnote}>Estimated CO₂e · last {data.windowDays} days</Text>
          </>
        ) : (
          <View style={s.row}>
            <View style={s.iconBubble}>
              <Ionicons name="layers-outline" size={18} color={UI.green} />
            </View>
            <View style={s.flex}>
              <Text style={s.panelTitle}>
                {data.areas.length} {data.areas.length === 1 ? "area" : "areas"} on the map
              </Text>
              <Text style={s.panelSub}>Tap a circle to see its estimated emissions.</Text>
            </View>
            <Pressable
              onPress={() => setRecenter((n) => n + 1)}
              style={({ pressed }) => [s.roundBtn, pressed && s.pressed]}
              accessibilityLabel="Show all areas"
            >
              <Ionicons name="scan-outline" size={18} color={UI.ink} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/** Floating header: title, subtitle, info button and the colour key. */
function TopCard({ onInfo, infoOpen, windowDays = 30 }: { onInfo: () => void; infoOpen?: boolean; windowDays?: number }) {
  return (
    <View style={[s.card, s.top]}>
      <View style={s.row}>
        <View style={s.flex}>
          <Text style={s.title}>Carbon Map</Text>
          <Text style={s.subtitle}>Estimated kg CO₂e per person · last {windowDays} days</Text>
        </View>
        <Pressable
          onPress={onInfo}
          hitSlop={8}
          style={[s.roundBtn, infoOpen && { backgroundColor: UI.greenSoft }]}
          accessibilityLabel="How this map works"
        >
          <Ionicons name={infoOpen ? "close" : "information-circle-outline"} size={20} color={infoOpen ? UI.green : UI.ink} />
        </Pressable>
      </View>
      <View style={s.legend}>
        {LEVELS.map((l) => (
          <View key={l.label} style={s.chip}>
            <View style={[s.chipDot, { backgroundColor: l.color }]} />
            <Text style={s.chipText} numberOfLines={1}>
              {l.label}
            </Text>
            <Text style={s.chipRange} numberOfLines={1}>
              {l.short}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={15} color={UI.green} style={{ marginTop: 1 }} />
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

function Stat({ value, unit, label, accent }: { value: number; unit?: string; label: string; accent?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, accent ? { color: accent } : null]}>
        {value}
        {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  pressed: { opacity: 0.75 },
  card: { position: "absolute", left: 12, right: 12, backgroundColor: UI.card, borderRadius: 20, padding: 14, ...cardShadow },

  // Top card
  top: { top: 10 },
  title: { fontSize: 20, fontWeight: "800", color: UI.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, color: UI.muted, marginTop: 2 },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: UI.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: { flexDirection: "row", gap: 6, marginTop: 12 },
  chip: {
    flexGrow: 1, // size to the text, then share any spare width
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: UI.bg,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: "600", color: UI.ink },
  chipRange: { fontSize: 11, color: UI.muted },

  // Info panel (under the top card)
  info: { top: 134, gap: 10 },
  infoTitle: { fontSize: 15, fontWeight: "700", color: UI.ink },
  infoRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, color: UI.ink, lineHeight: 18 },
  credit: { fontSize: 11, color: UI.muted, marginTop: 2 },

  // Bottom panel
  panel: { bottom: ABOVE_TAB_BAR, gap: 12 },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: UI.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  levelDot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 4 },
  panelTitle: { fontSize: 15, fontWeight: "700", color: UI.ink },
  panelSub: { fontSize: 12.5, color: UI.muted, marginTop: 2, lineHeight: 17 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: UI.bg, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: UI.bg, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: UI.ink, letterSpacing: -0.3 },
  statUnit: { fontSize: 12, fontWeight: "600", color: UI.muted },
  statLabel: { fontSize: 11, color: UI.muted, marginTop: 2 },
  footnote: { fontSize: 11, color: UI.muted, textAlign: "center" },
  primaryBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: UI.green,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Loading / error
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 6 },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: UI.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stateTitle: { fontSize: 18, fontWeight: "700", color: UI.ink },
  stateText: { fontSize: 14, color: UI.muted, textAlign: "center" },
  stateBtn: { marginTop: 14, paddingHorizontal: 22 },
});
