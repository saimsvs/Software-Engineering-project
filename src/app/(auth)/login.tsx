import { Logo } from "@/components/logo";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/config/api";
import { resetTo } from "@/utils/nav";
import { saveToken } from "@/utils/storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { UI } from "@/constants/ui";
const DARK = "#1A1A1A";
const RED = "#C62828";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Set by the verify-code screen after a successful verification.
  const { verified } = useLocalSearchParams<{ verified?: string }>();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.code === "EMAIL_NOT_VERIFIED") {
        // The backend has just emailed a fresh code; go straight to entering it.
        router.push({ pathname: "/verify-code", params: { email: data.email ?? email.trim() } });
        return;
      }

      if (!res.ok) {
        setError(res.status === 401 ? "Incorrect email or password." : data.message || "Login failed. Please try again.");
        return;
      }

      await saveToken(data.token);
      // Clear Login/Register/Verify from the history so "back" from the app
      // doesn't return to them.
      resetTo(router, data.user?.role === "organizer" ? "/organizer" : "/home");
    } catch {
      setError("Can't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
      {/* Login is usually the first screen: only offer "back" when there is
          somewhere to go back to. */}
      {router.canGoBack() ? (
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.backSpacer} />
      )}

      <View style={styles.logoContainer}>
        <Logo size={64} />
      </View>

      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Track your carbon footprint</Text>

      {verified === "1" && !error && (
        <View style={[styles.banner, styles.bannerSuccess]} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={UI.green} />
          <Text style={[styles.bannerText, { color: UI.greenDark }]}>Email verified. You can log in now.</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError("");
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) setError("");
          }}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" style={styles.eye} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity>
        <Text style={styles.forgot}>Forgot Password?</Text>
      </TouchableOpacity>

      {!!error && (
        <View style={[styles.banner, styles.bannerError]} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={RED} />
          <Text style={[styles.bannerText, { color: RED }]}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Login"}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity onPress={() => router.push("/register")}>
        <Text style={styles.registerText}>
          Don't have an account?{" "}
          <Text style={styles.registerLink}>Register</Text>
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
    paddingHorizontal: 20,
  },
  scroll: {
    flexGrow: 1,
  },
  backArrow: {
    fontSize: 28,
    color: DARK,
    marginTop: 50,
  },
  backSpacer: {
    height: 84,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  bannerError: { backgroundColor: "#FDECEA", marginTop: 4 },
  bannerSuccess: { backgroundColor: UI.greenSoft },
  bannerText: { flex: 1, fontSize: 13.5 },
  logoContainer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#CCC",
    justifyContent: "center",
    alignItems: "center",
  },
  logoIcon: {
    fontSize: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: DARK,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#FFF",
    marginBottom: 14,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    backgroundColor: "#FFF",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#333",
  },
  eye: {
    paddingHorizontal: 14,
  },
  forgot: {
    color: "#666",
    textAlign: "right",
    marginTop: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  button: {
    backgroundColor: DARK,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  orText: {
    marginHorizontal: 16,
    color: "#999",
    fontSize: 14,
  },
  registerText: {
    textAlign: "center",
    fontSize: 14,
    color: "#666",
  },
  registerLink: {
    color: DARK,
    fontWeight: "bold",
  },
});
