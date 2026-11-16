import { OfflineBanner } from "@/components/offline-banner";
import { setupAutoSync, syncQueueIfNeeded } from "@/services/offlineSync";
import { NavigationBar } from "expo-navigation-bar";
import { DefaultTheme, ThemeProvider, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// The app is light-only (userInterfaceStyle: "light" in app.json) — every
// screen hardcodes the white theme, so always use the light navigation theme
// regardless of the OS dark-mode setting.
const LIGHT_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "#FFFFFF" },
};

// Android is edge-to-edge on modern SDKs, so the system bars are transparent
// and whatever sits behind them shows through. Paint the root view white so
// the bar area is white instead of the (dark) native window background.
SystemUI.setBackgroundColorAsync("#FFFFFF");

export default function RootLayout() {

  useEffect(() => {
    // Setup auto-sync on network reconnect
    const unsubscribe = setupAutoSync();

    // Try to sync on app start
    syncQueueIfNeeded();

    // ...and every time the app returns to the foreground, in case the phone
    // regained connectivity while the app was in the background.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") syncQueueIfNeeded();
    });

    return () => {
      unsubscribe();
      appState.remove();
    };
  }, []);

  return (
    <ThemeProvider value={LIGHT_THEME}>
      {/* Dark status-bar icons/text over the app's white theme (system bars
          are edge-to-edge/transparent on modern Android, so they pick up the
          white background automatically) */}
      <StatusBar style="dark" />
      {/* Android nav bar: "dark" = dark buttons on a light (white) background,
          which matches the app's light-only theme. No-op on iOS. */}
      <NavigationBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="organizer" />
          <Stack.Screen name="log/activity" />
          <Stack.Screen name="log/details" />
          <Stack.Screen name="log/review" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="stats" />
        </Stack>
      </SafeAreaView>
    </ThemeProvider>
  );
}
