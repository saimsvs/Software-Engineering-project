import { BlurTargetView, BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { UI } from "@/constants/ui";

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
    <Pressable
      ref={ref}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.tabItem, isFocused && styles.tabItemActive]}
    >
      <Ionicons name={isFocused ? iconActive : icon} size={20} color={isFocused ? UI.green : GRAY} />
      {isFocused && <Text style={styles.tabLabel}>{label}</Text>}
    </Pressable>
  );
}

/**
 * Compact floating tab bar: a small frosted-glass pill centred at the bottom.
 * The active tab expands into a soft green capsule with its label; the others
 * show just their icon. On Android, expo-blur needs the content wrapped in BlurTargetView and
 * passed via blurTarget + blurMethod="dimezisBlurView" — otherwise it falls
 * back to a dimmed (dark) non-blurred overlay.
 */
export default function TabLayout() {
  const tabContentRef = useRef<View>(null);

  return (
    <Tabs>
      <BlurTargetView ref={tabContentRef} style={styles.tabContent}>
        <TabSlot />
      </BlurTargetView>

      <TabList style={[styles.pill, { bottom: 10 }]}>
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
        <TabTrigger name="community" href="/community" asChild>
          <TabButton icon="people-outline" iconActive="people" label="Community" />
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
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 5,
    borderRadius: 999,
    // Translucent white base — with the real blur behind it this reads as
    // frosted glass on both platforms.
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  tabItem: {
    height: 42,
    minWidth: 48,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: UI.greenSoft,
    paddingHorizontal: 16,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: UI.green,
  },
});
