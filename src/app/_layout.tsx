import { OfflineBanner } from "@/components/offline-banner";
import { setupAutoSync, syncQueueIfNeeded } from "@/services/offlineSync";
import { DefaultTheme, ThemeProvider, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

// The app is light-only (userInterfaceStyle: "light" in app.json) — every
// screen hardcodes the white theme, so always use the light navigation theme
// regardless of the OS dark-mode setting.
const LIGHT_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "#FFFFFF" },
};

export default function RootLayout() {

  useEffect(() => {
    // Setup auto-sync on network reconnect
    const unsubscribe = setupAutoSync();
    
    // Try to sync on app start
    syncQueueIfNeeded();
    
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider value={LIGHT_THEME}>
      {/* Dark status-bar icons/text over the app's white theme (system bars
          are edge-to-edge/transparent on modern Android, so they pick up the
          white background automatically) */}
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
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
