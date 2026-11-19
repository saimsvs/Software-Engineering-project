import { Logo } from "@/components/logo";
import { API_URL } from "@/config/api";
import { UI } from "@/constants/ui";
import { backToLogin } from "@/utils/nav";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

const DARK = "#1A1A1A";
const RED = "#C62828";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

type Field = "email" | "code" | "password" | "confirm";
type FieldErrors = Partial<Record<Field, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={14} color={RED} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Forgot password, in two steps on one screen:
 *   1. enter your email -> a 6-digit code is emailed (if the account exists)
 *   2. enter the code + a new password -> back to Login with a success message
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  // Login passes along whatever was already typed in its email box.
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const edit = (field: Field, setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (formError) setFormError("");
  };

  const goBack = () => (router.canGoBack() ? router.back() : backToLogin(router));

  async function sendCode() {
    const trimmed = email.trim();
    if (!trimmed) return setErrors({ email: "Please enter your email" });
    if (!EMAIL_RE.test(trimmed)) return setErrors({ email: "Enter a valid email address, like name@example.com" });

    setErrors({});
    setFormError("");
    setLoading(true);
    try {
      const { res, data } = await postJson("/api/auth/forgot-password", { email: trimmed });
      if (!res.ok) {
        if (data.fieldErrors?.email) setErrors({ email: data.fieldErrors.email });
        else setFormError(data.message || "Something went wrong. Please try again.");
        return;
      }
      setInfo(`If an account exists for ${trimmed}, we've emailed it a 6-digit code. It expires in 10 minutes.`);
      setCooldown(RESEND_SECONDS);
      setStep("reset");
    } catch {
      setFormError("Can't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const found: FieldErrors = {};
    if (!/^\d{6}$/.test(code.trim())) found.code = "Enter the 6-digit code from your email";
    if (!password) found.password = "Please enter a new password";
    else if (password.length < 8) found.password = "Password must be at least 8 characters";
    else if (password.length > 72) found.password = "Password must be 72 characters or fewer";
    if (!confirm) found.confirm = "Please confirm your new password";
    else if (password && confirm !== password) found.confirm = "Passwords don't match";
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const { res, data } = await postJson("/api/auth/reset-password", {
        email: email.trim(),
        code: code.trim(),
        password,
      });
      if (!res.ok) {
        const server: FieldErrors = {};
        if (data.fieldErrors?.code) server.code = data.fieldErrors.code;
        if (data.fieldErrors?.password) server.password = data.fieldErrors.password;
        setErrors(server);
        // Anything else (e.g. a problem with the email from step 1) goes in the banner.
        if (!server.code && !server.password) {
          setFormError(data.fieldErrors?.email || data.message || "Something went wrong. Please try again.");
        }
        return;
      }
      backToLogin(router, { reset: "1" });
    } catch {
      setFormError("Can't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || loading) return;
    setFormError("");
    setLoading(true);
    try {
      const { res } = await postJson("/api/auth/forgot-password", { email: email.trim() });
      if (!res.ok) throw new Error();
      setCode("");
      setInfo(`We've sent a new code to ${email.trim()} (if an account exists). Use the newest one.`);
      setCooldown(RESEND_SECONDS);
    } catch {
      setFormError("Couldn't send a new code. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={goBack} accessibilityLabel="Go back">
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Logo size={64} />
        </View>

        <Text style={styles.title}>{step === "email" ? "Forgot password?" : "Reset your password"}</Text>
        <Text style={styles.subtitle}>
          {step === "email"
            ? "Enter your account email and we'll send you a 6-digit code."
            : "Enter the code from your email and choose a new password."}
        </Text>

        {step === "email" ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={edit("email", setEmail)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              onSubmitEditing={sendCode}
            />
            <FieldError message={errors.email} />
          </>
        ) : (
          <>
            {!!info && (
              <View style={[styles.banner, styles.bannerInfo]} accessibilityLiveRegion="polite">
                <Ionicons name="mail-outline" size={18} color={UI.green} />
                <Text style={[styles.bannerText, { color: UI.greenDark }]}>{info}</Text>
              </View>
            )}

            <Text style={styles.label}>6-digit code</Text>
            <TextInput
              style={[styles.input, styles.codeInput, errors.code && styles.inputError]}
              placeholder="000000"
              placeholderTextColor="#BBB"
              value={code}
              onChangeText={edit("code", (v) => setCode(v.replace(/\D/g, "").slice(0, 6)))}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
            <FieldError message={errors.code} />

            <Text style={styles.label}>New password</Text>
            <View style={[styles.passwordRow, errors.password && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="New password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={edit("password", setPassword)}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} accessibilityLabel="Show or hide password">
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#666"
                  style={styles.eye}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <FieldError message={errors.password} />
            ) : (
              <Text style={styles.hint}>At least 8 characters</Text>
            )}

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={[styles.input, errors.confirm && styles.inputError]}
              placeholder="Confirm new password"
              placeholderTextColor="#999"
              value={confirm}
              onChangeText={edit("confirm", setConfirm)}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <FieldError message={errors.confirm} />
          </>
        )}

        {!!formError && (
          <View style={[styles.banner, styles.bannerError]} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color={RED} />
            <Text style={[styles.bannerText, { color: RED }]}>{formError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={step === "email" ? sendCode : resetPassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? step === "email"
                ? "Sending…"
                : "Saving…"
              : step === "email"
                ? "Send code"
                : "Reset password"}
          </Text>
        </TouchableOpacity>

        {step === "reset" && (
          <View style={styles.linksRow}>
            <TouchableOpacity onPress={resend} disabled={cooldown > 0 || loading}>
              <Text style={[styles.link, (cooldown > 0 || loading) && styles.linkDisabled]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setStep("email");
                setCode("");
                setPassword("");
                setConfirm("");
                setErrors({});
                setFormError("");
              }}
            >
              <Text style={styles.link}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => backToLogin(router)}>
          <Text style={styles.loginText}>
            Remembered it? <Text style={styles.loginLink}>Back to Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  backArrow: { fontSize: 28, color: DARK, marginTop: 50, marginBottom: 10 },
  logoContainer: { alignItems: "center", marginTop: 10, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: DARK, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginTop: 6, marginBottom: 10, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "500", color: "#333", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#FFF",
  },
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: "center", fontWeight: "600" },
  inputError: { borderColor: RED, borderWidth: 1.5 },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    backgroundColor: "#FFF",
  },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: "#333" },
  eye: { paddingHorizontal: 14 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  errorText: { flex: 1, fontSize: 12.5, color: RED },
  hint: { fontSize: 12.5, color: "#777", marginTop: 6 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  bannerInfo: { backgroundColor: UI.greenSoft },
  bannerError: { backgroundColor: "#FDECEA" },
  bannerText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  button: { backgroundColor: DARK, borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  linksRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  link: { fontSize: 14, color: UI.green, fontWeight: "600" },
  linkDisabled: { color: "#9E9E9E" },
  loginText: { textAlign: "center", fontSize: 14, color: "#666", marginTop: 28 },
  loginLink: { color: DARK, fontWeight: "bold" },
});
