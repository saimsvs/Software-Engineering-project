import { ScreenHeader } from "@/components/screen-header";
import { UI, cardShadow } from "@/constants/ui";
import { apiFetch } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Goal = { id: string; name: string; targetValue: number; targetUnit: string; deadline: string; isPublic: boolean };
const units = ["kg CO₂e", "activities", "days"] as const;
const RED = "#C62828";

type Field = "name" | "target" | "deadline";
type FieldErrors = Partial<Record<Field, string>>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Same rules as the backend (POST /api/features/goals). */
function validate(name: string, target: string, deadline: string): FieldErrors {
  const e: FieldErrors = {};
  if (!name.trim()) e.name = "Give your goal a name";

  const amount = Number(target);
  if (!target.trim()) e.target = "Enter a target number";
  else if (!Number.isFinite(amount) || amount <= 0) e.target = "Target must be a number greater than 0";

  if (!deadline.trim()) e.deadline = "Enter a deadline";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) e.deadline = "Use the format YYYY-MM-DD, e.g. 2026-12-31";
  else {
    const d = new Date(`${deadline}T00:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== deadline) {
      e.deadline = "That date doesn't exist";
    } else if (deadline < todayISO()) {
      e.deadline = "Choose a date in the future";
    }
  }
  return e;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={s.errorRow} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={14} color={RED} />
      <Text style={s.errorText}>{message}</Text>
    </View>
  );
}

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState<(typeof units)[number]>("kg CO₂e");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch("/api/features/goals");
      if (!response.ok) throw new Error();
      setGoals((await response.json()).goals);
      setLoadError("");
    } catch {
      setLoadError("Couldn't load your goals. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const edit = (field: Field, setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (formError) setFormError("");
    if (success) setSuccess("");
  };

  async function create() {
    const found = validate(name, target, deadline);
    setErrors(found);
    setFormError("");
    setSuccess("");
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const response = await apiFetch("/api/features/goals", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), targetValue: Number(target), targetUnit: unit, deadline }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (/deadline/i.test(data.message ?? "")) setErrors({ deadline: data.message });
        else setFormError(data.message || "Couldn't create your goal. Please try again.");
        return;
      }
      setName("");
      setTarget("");
      setDeadline("");
      setSuccess("Goal created. It's private and saved to your list below.");
      await refresh();
    } catch {
      setFormError("Can't reach the server. Check your internet connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScreenHeader title="My Goals" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.heading}>Create a sustainability goal</Text>
          <Text style={s.help}>Make a measurable commitment. New goals are private by default.</Text>

          <Text style={s.label}>Goal name</Text>
          <TextInput
            style={[s.field, errors.name && s.fieldError]}
            placeholder="e.g. Reduce my weekly emissions"
            placeholderTextColor="#999"
            value={name}
            onChangeText={edit("name", setName)}
            maxLength={120}
          />
          <FieldError message={errors.name} />

          <Text style={s.label}>Target</Text>
          <TextInput
            style={[s.field, errors.target && s.fieldError]}
            placeholder="e.g. 20"
            placeholderTextColor="#999"
            value={target}
            onChangeText={edit("target", setTarget)}
            keyboardType="decimal-pad"
          />
          <FieldError message={errors.target} />
          <View style={s.units}>
            {units.map((u) => (
              <TouchableOpacity key={u} style={[s.choice, unit === u && s.selected]} onPress={() => setUnit(u)}>
                <Text style={[s.choiceText, unit === u && s.selectedText]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Deadline</Text>
          <TextInput
            style={[s.field, errors.deadline && s.fieldError]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            value={deadline}
            onChangeText={edit("deadline", setDeadline)}
            maxLength={10}
            autoCapitalize="none"
          />
          <FieldError message={errors.deadline} />

          <View style={s.privateRow}>
            <Ionicons name="lock-closed-outline" size={14} color={UI.green} />
            <Text style={s.private}>Only you can view this goal</Text>
          </View>

          {!!formError && (
            <View style={[s.banner, s.bannerError]} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={18} color={RED} />
              <Text style={[s.bannerText, { color: RED }]}>{formError}</Text>
            </View>
          )}
          {!!success && (
            <View style={[s.banner, s.bannerSuccess]} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={18} color={UI.green} />
              <Text style={[s.bannerText, { color: UI.greenDark }]}>{success}</Text>
            </View>
          )}

          <TouchableOpacity style={[s.button, saving && { opacity: 0.5 }]} disabled={saving} onPress={create}>
            <Text style={s.buttonText}>{saving ? "Saving…" : "Create Goal"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Your goals</Text>
        {loading ? (
          <ActivityIndicator color={UI.green} />
        ) : loadError ? (
          <View style={[s.banner, s.bannerError]}>
            <Ionicons name="alert-circle" size={18} color={RED} />
            <Text style={[s.bannerText, { color: RED }]}>{loadError}</Text>
          </View>
        ) : goals.length === 0 ? (
          <Text style={s.help}>No goals yet. Create your first one above.</Text>
        ) : (
          goals.map((g) => (
            <View key={g.id} style={s.goal}>
              <View style={s.goalIcon}>
                <Ionicons name="flag-outline" size={18} color={UI.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.goalName}>{g.name}</Text>
                <Text style={s.help}>
                  Target: {g.targetValue} {g.targetUnit}
                </Text>
                <Text style={s.help}>
                  Deadline: {g.deadline.slice(0, 10)} · {g.isPublic ? "Public" : "Private"}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: UI.bg },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: UI.card, borderRadius: UI.radius, padding: 18, ...cardShadow },
  heading: { fontWeight: "800", fontSize: 20, color: UI.ink, letterSpacing: -0.3 },
  sectionTitle: { fontWeight: "700", fontSize: 17, color: UI.ink, marginTop: 10, letterSpacing: -0.2 },
  help: { fontSize: 13, color: UI.muted, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 16, marginBottom: 6 },
  field: {
    borderColor: "#E0E0E0",
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 15,
    color: UI.ink,
    backgroundColor: "#FFF",
  },
  fieldError: { borderColor: RED, borderWidth: 1.5 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  errorText: { flex: 1, fontSize: 12.5, color: RED },
  units: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 },
  choice: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F2F3F2" },
  selected: { backgroundColor: UI.greenSoft },
  choiceText: { color: "#555", fontSize: 13 },
  selectedText: { color: UI.green, fontWeight: "700" },
  privateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  private: { color: UI.green, fontSize: 12.5 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 },
  bannerError: { backgroundColor: "#FDECEA" },
  bannerSuccess: { backgroundColor: UI.greenSoft },
  bannerText: { flex: 1, fontSize: 13.5 },
  button: { height: 52, backgroundColor: UI.green, borderRadius: 14, justifyContent: "center", alignItems: "center", marginTop: 16 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  goal: { flexDirection: "row", gap: 12, backgroundColor: UI.card, borderRadius: 16, padding: 16, ...cardShadow },
  goalIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: UI.greenSoft, alignItems: "center", justifyContent: "center" },
  goalName: { fontSize: 16, fontWeight: "700", color: UI.ink, marginBottom: 2 },
});
