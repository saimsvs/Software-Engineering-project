import { Ionicons } from "@expo/vector-icons";
import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { useRouter } from "expo-router";
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
    <Pressable
      ref={ref}
      onPress={onPress}
      style={[styles.tabItem, isFocused && styles.tabItemActive]}
      hitSlop={4}
    >
      <Ionicons
        name={isFocused ? iconActive : icon}
        size={22}
        color={isFocused ? "#FFFFFF" : GRAY}
      />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Tabs>
      <TabSlot />

      {/* Floating pill tab bar */}
      <TabList
        style={[styles.pill, { bottom: Math.max(insets.bottom, 10) + 8 }]}
      >
        <TabTrigger name="home" href="/home" asChild>
          <TabButton icon="home-outline" iconActive="home" label="Home" />
        </TabTrigger>

        {/* Raised center action button */}
        <Pressable
          style={styles.fab}
          onPress={() => router.push("/log/activity")}
          hitSlop={8}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </Pressable>

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
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ECECEC",
    // iOS shadow
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    // Android shadow
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 20,
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: GREEN,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: GRAY,
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
});
