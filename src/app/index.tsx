import { apiFetch } from "@/utils/api";
import { getToken, clearToken } from "@/utils/storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type AuthState = "checking" | "loggedOut" | "loggedIn";

export default function Index() {
  const [state, setState] = useState<AuthState>("checking");

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          setState("loggedOut");
          return;
        }
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          setState("loggedIn");
        } else {
          await clearToken();
          setState("loggedOut");
        }
      } catch {
        setState("loggedOut");
      }
    })();
  }, []);

  if (state === "checking") {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>🍃</Text>
        <Text style={styles.title}>CarbonTrail</Text>
        <ActivityIndicator color="#2E7D32" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return <Redirect href={state === "loggedIn" ? "/home" : "/login"} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: { fontSize: 56 },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E7D32", marginTop: 8 },
});
