import { Platform, type ViewStyle } from "react-native";

/** Shared design tokens for the app's modern look. */
export const UI = {
  green: "#2E7D32",
  greenDark: "#1B5E20",
  greenSoft: "#E8F5E9",
  ink: "#1A1A1A",
  muted: "#6B7280",
  /** App background: a faint warm grey so white cards stand out. */
  bg: "#F5F7F5",
  card: "#FFFFFF",
  hairline: "rgba(0,0,0,0.06)",
  radius: 18,
} as const;

/** Soft elevation used for cards instead of grey outlines. */
export const cardShadow: ViewStyle = Platform.select<ViewStyle>({
  web: { boxShadow: "0 1px 2px rgba(16,24,16,0.04), 0 4px 14px rgba(16,24,16,0.06)" } as ViewStyle,
  ios: {
    shadowColor: "#102010",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  default: { elevation: 2 },
})!;

/** Space to leave under scrolling content so the floating tab bar never covers it. */
export const TAB_BAR_CLEARANCE = 96;
