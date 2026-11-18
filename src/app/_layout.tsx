import { OfflineBanner } from "@/components/offline-banner";
import { UI } from "@/constants/ui";
import { setupAutoSync, syncQueueIfNeeded } from "@/services/offlineSync";
import { NavigationBar } from "expo-navigation-bar";
import { DefaultTheme, ThemeProvider, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// The app is light-only (userInterfaceStyle: "light" in app.json), so always
// use the light navigation theme, painted in the app's background colour.
const LIGHT_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: UI.bg },
};

// Android is edge-to-edge on modern SDKs: the status bar and navigation bar
// are transparent and whatever sits behind them shows through. Paint the root
// view in the same colour as every screen so the bars blend in.
SystemUI.setBackgroundColorAsync(UI.bg);

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
      {/* Dark status-bar icons over the app's light background */}
      <StatusBar style="dark" />
      {/* Android nav bar: dark buttons on the light background. No-op on iOS. */}
      <NavigationBar style="dark" />
      {/* Keep every screen clear of the status bar (top) and the phone's
          navigation/gesture bar (bottom), in one place, so no screen's content
          can slide under them. Same colour as the screens, so no visible band. */}
      <SafeAreaView style={{ flex: 1, backgroundColor: UI.bg }} edges={["top", "bottom"]}>
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
