import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GREEN = "#2E7D32";
const GRAY = "#8A8A8E";

type TabButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused?: boolean;
  onPress?: () => void;
  ref?: React.Ref<View>;
};

function TabButton({ icon, iconActive, label, isFocused, onPress, ref }: TabButtonProps) {
  return (
    <Pressable ref={ref} onPress={onPress} style={styles.tabItem} hitSlop={4}>
      <Ionicons
        name={isFocused ? iconActive : icon}
        size={24}
        color={isFocused ? GREEN : GRAY}
      />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Apple-style floating tab bar: translucent frosted pill (real blur on iOS,
 * translucent-white fallback on Android) with Home / Map only.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />

      <TabList style={[styles.pill, { bottom: Math.max(insets.bottom, 10) + 8 }]}>
        <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
        <TabTrigger name="home" href="/home" asChild>
          <TabButton icon="home-outline" iconActive="home" label="Home" />
        </TabTrigger>
        <TabTrigger name="map" href="/map" asChild>
          <TabButton icon="map-outline" iconActive="map" label="Map" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Translucent base so it reads as frosted glass on BOTH platforms
    // (iOS layers the real BlurView vibrancy on top of it)
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    // iOS shadow
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    // Android shadow
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: GRAY,
  },
  tabLabelActive: {
    color: GREEN,
    fontWeight: "700",
  },
});
