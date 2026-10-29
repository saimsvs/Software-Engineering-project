import { OfflineBanner } from "@/components/offline-banner";
import { setupAutoSync, syncQueueIfNeeded } from "@/services/offlineSync";
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {/* Dark status-bar icons/text over the app's white theme (system bars
          are edge-to-edge/transparent on modern Android, so they pick up the
          white background automatically) */}
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
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
