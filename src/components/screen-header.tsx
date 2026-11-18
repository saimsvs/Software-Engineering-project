import { Ionicons } from "@expo/vector-icons";
import { UI, cardShadow } from "@/constants/ui";
import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const DARK = "#111114";
const MUTED = "#8A8A8E";

/**
 * Shared top app bar for stack screens: a soft circular back button, a
 * centered title (optional subtitle) and a symmetric right slot so the title
 * stays optically centered. A hairline divider separates it from the content.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  showBack?: boolean;
}) {
  const router = useRouter();
  const back = onBack ?? (() => router.back());

  return (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity
          onPress={back}
          style={styles.backBtn}
          activeOpacity={0.6}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={DARK} />
        </TouchableOpacity>
      ) : (
        <View style={styles.rightSlot} />
      )}

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: 12,
    backgroundColor: UI.bg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI.card,
    ...cardShadow,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: DARK,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: MUTED,
    marginTop: 1,
  },
  rightSlot: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
