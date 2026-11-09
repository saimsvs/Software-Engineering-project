import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const DARK = "#1A1A1A";

/**
 * Shared top bar for stack screens: circular back button + centered title.
 * Gives every secondary screen the same professional header.
 */
export function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const back = onBack ?? (() => router.back());

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={back}
        style={styles.backBtn}
        activeOpacity={0.6}
        hitSlop={10}
      >
        <Ionicons name="chevron-back" size={22} color={DARK} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.backBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: DARK,
  },
});
