import { BlurTargetView, BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { useRef } from "react";
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
        size={22}
        color={isFocused ? GREEN : GRAY}
      />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Apple-style floating tab bar: a compact frosted-glass pill with Home / Map
 * only. On Android, expo-blur needs the content wrapped in BlurTargetView and
 * passed via blurTarget + blurMethod="dimezisBlurView" — otherwise it falls
 * back to a dimmed (dark) non-blurred overlay.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabContentRef = useRef<View>(null);

  return (
    <Tabs>
      <BlurTargetView ref={tabContentRef} style={styles.tabContent}>
        <TabSlot />
      </BlurTargetView>

      <TabList style={[styles.pill, { bottom: Math.max(insets.bottom, 10) + 8 }]}>
        <BlurView
          blurTarget={tabContentRef}
          blurMethod="dimezisBlurView"
          intensity={50}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
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
  tabContent: {
    flex: 1,
  },
  pill: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Translucent white base — together with the real blur above it this
    // reads as frosted glass on BOTH platforms (iOS gets native vibrancy)
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    // iOS shadow
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    // Android shadow
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: GRAY,
  },
  tabLabelActive: {
    color: GREEN,
    fontWeight: "700",
  },
});
