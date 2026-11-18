import { Logo } from "@/components/logo";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/config/api";
import { useRouter } from "expo-router";
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

const GREEN = "#2E7D32";
const DARK = "#1A1A1A";
const RED = "#C62828";

type Field = "name" | "email" | "password" | "confirm" | "terms";
type FieldErrors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same rules as the backend, checked before we send anything. */
function validate(v: {
  name: string;
  email: string;
  password: string;
  confirm: string;
  agreed: boolean;
}): FieldErrors {
  const e: FieldErrors = {};
  if (!v.name.trim()) e.name = "Please enter your name";
  else if (v.name.trim().length > 60) e.name = "Name must be 60 characters or fewer";

  if (!v.email.trim()) e.email = "Please enter your email";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address, like name@example.com";

  if (!v.password) e.password = "Please enter a password";
  else if (v.password.length < 8) e.password = "Password must be at least 8 characters";
  else if (v.password.length > 72) e.password = "Password must be 72 characters or fewer";

  if (!v.confirm) e.confirm = "Please confirm your password";
  else if (v.password && v.confirm !== v.password) e.confirm = "Passwords don't match";

  if (!v.agreed) e.terms = "Please accept the Terms of Service to continue";
  return e;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={14} color={RED} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  /** Update a field and clear its error as soon as the user edits it. */
  const edit = (field: Field, setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (formError) setFormError("");
  };

  const handleRegister = async () => {
    const found = validate({ name, email, password, confirm: confirmPassword, agreed });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const server: FieldErrors = {};
        for (const field of ["name", "email", "password"] as const) {
          if (data.fieldErrors?.[field]) server[field] = data.fieldErrors[field];
        }
        setErrors(server);
        if (Object.keys(server).length === 0) {
          setFormError(data.message || "Something went wrong. Please try again.");
        }
        return;
      }

      router.push({ pathname: "/verify-code", params: { email: email.trim() } });
    } catch {
      setFormError("Can't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <View style={styles.logoContainer}>
        <Logo size={64} />
      </View>

      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Start tracking your carbon footprint</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        placeholder="Full Name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={edit("name", setName)}
        autoComplete="name"
        textContentType="name"
      />
      <FieldError message={errors.name} />

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
      />
      <FieldError message={errors.email} />

      <Text style={styles.label}>Password</Text>
      <View style={[styles.passwordRow, errors.password && styles.inputError]}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={edit("password", setPassword)}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" style={styles.eye} />
        </TouchableOpacity>
      </View>

      {errors.password ? (
        <FieldError message={errors.password} />
      ) : (
        <Text style={styles.hint}>At least 8 characters</Text>
      )}

      <Text style={styles.label}>Confirm Password</Text>
      <View style={[styles.passwordRow, errors.confirm && styles.inputError]}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Confirm Password"
          placeholderTextColor="#999"
          value={confirmPassword}
          onChangeText={edit("confirm", setConfirmPassword)}
          secureTextEntry={!showConfirm}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
          <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#666" style={styles.eye} />
        </TouchableOpacity>
      </View>
      <FieldError message={errors.confirm} />

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => {
          setAgreed(!agreed);
          if (errors.terms) setErrors((prev) => ({ ...prev, terms: undefined }));
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
      >
        <View style={[styles.checkbox, agreed && styles.checkboxChecked, errors.terms && styles.checkboxError]}>
          {agreed && <Ionicons name="checkmark" size={14} color="#FFF" />}
        </View>
        <Text style={styles.termsText}>
          I agree to Terms of Service and Privacy Policy
        </Text>
      </TouchableOpacity>
      <FieldError message={errors.terms} />

      {!!formError && (
        <View style={styles.formError} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={RED} />
          <Text style={styles.formErrorText}>{formError}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating..." : "Register"}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.loginText}>
          Already have an account? <Text style={styles.loginLink}>Login</Text>
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
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backArrow: {
    fontSize: 28,
    color: DARK,
    marginTop: 50,
    marginBottom: 10,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
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
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
    marginBottom: 6,
    marginTop: 14,
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
  },
  inputError: {
    borderColor: RED,
    borderWidth: 1.5,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    color: RED,
  },
  hint: {
    fontSize: 12.5,
    color: "#777",
    marginTop: 6,
  },
  checkboxError: {
    borderColor: RED,
  },
  formError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDECEA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
  },
  formErrorText: {
    flex: 1,
    fontSize: 13.5,
    color: RED,
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: "#999",
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  termsText: {
    fontSize: 13,
    color: "#333",
    flex: 1,
  },
  button: {
    backgroundColor: DARK,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
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
  loginText: {
    textAlign: "center",
    fontSize: 14,
    color: "#666",
  },
  loginLink: {
    color: DARK,
    fontWeight: "bold",
  },
});
