import { ScreenHeader } from "@/components/screen-header";
import { UI, cardShadow } from "@/constants/ui";
import { apiFetch } from "@/utils/api";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GoalProgress = {
  current: number;
  target: number;
  percent: number;
  /** "budget" = stay under the target (kg CO₂e); "count" = reach the target */
  kind: "budget" | "count";
  status: "in_progress" | "achieved" | "missed" | "over_budget";
  daysLeft: number;
};
type Goal = {
  id: string;
  name: string;
  targetValue: number;
  targetUnit: string;
  /** Activity category that counts toward the goal; null = every activity. */
  category?: Category | null;
  deadline: string;
  isPublic: boolean;
  /**
   * Worked out by the server. Optional so an older backend (e.g. mid-deploy)
   * that doesn't send it yet can't crash this screen.
   */
  progress?: GoalProgress | null;
};

// Same categories as the activity list; each logged activity carries one.
const CATEGORIES = ["Transport", "Energy", "Food", "Waste"] as const;
type Category = (typeof CATEGORIES)[number];

function countsLabel(category: Category | null | undefined): string {
  return category ? `${category} only` : "All activities";
}

const STATUS: Record<GoalProgress["status"], { label: string; color: string; bg: string }> = {
  in_progress: { label: "In progress", color: "#1565C0", bg: "#E3F2FD" },
  achieved: { label: "Achieved", color: UI.greenDark, bg: UI.greenSoft },
  missed: { label: "Missed", color: "#6B7280", bg: "#F1F2F4" },
  over_budget: { label: "Over budget", color: "#C62828", bg: "#FDECEA" },
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** e.g. "2.4 of 5 kg CO₂e used" or "3 of 5 days". */
function progressText(g: Goal & { progress: GoalProgress }): string {
  const { current, target, kind } = g.progress;
  return kind === "budget"
    ? `${fmt(current)} of ${fmt(target)} ${g.targetUnit} used`
    : `${fmt(current)} of ${fmt(target)} ${g.targetUnit}`;
}

/** Ask before deleting. Alert.alert has no buttons on web, so use confirm() there. */
function confirmDelete(name: string, onYes: () => void) {
  const message = `Delete "${name}"? This can't be undone.`;
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(message)) onYes();
    return;
  }
  Alert.alert("Delete goal?", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onYes },
  ]);
}
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
  const [category, setCategory] = useState<Category | null>(null);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadError, setLoadError] = useState("");
  // Set while editing an existing goal: the form above switches to edit mode.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

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

  function resetForm() {
    setEditingId(null);
    setName("");
    setTarget("");
    setDeadline("");
    setUnit("kg CO₂e");
    setCategory(null);
    setErrors({});
    setFormError("");
  }

  function startEdit(g: Goal) {
    setEditingId(g.id);
    setName(g.name);
    setTarget(String(g.targetValue));
    setUnit(g.targetUnit as (typeof units)[number]);
    setCategory(g.category ?? null);
    setDeadline(g.deadline.slice(0, 10));
    setErrors({});
    setFormError("");
    setSuccess("");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function remove(g: Goal) {
    confirmDelete(g.name, async () => {
      setBusyId(g.id);
      setFormError("");
      setSuccess("");
      try {
        const response = await apiFetch(`/api/features/goals/${g.id}`, { method: "DELETE" });
        // 404 means it's already gone, which is what the user wanted anyway.
        if (!response.ok && response.status !== 404) throw new Error();
        if (editingId === g.id) resetForm();
        setSuccess(`"${g.name}" was deleted.`);
        await refresh();
      } catch {
        setFormError("Couldn't delete that goal. Check your connection and try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  async function toggleShare(g: Goal) {
    setBusyId(g.id);
    setFormError("");
    setSuccess("");
    try {
      const response = await apiFetch(`/api/features/goals/${g.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublic: !g.isPublic }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setFormError("That goal no longer exists.");
          await refresh();
          return;
        }
        throw new Error(data.message ?? "Save failed");
      }
      const updated = (await response.json()).goal;
      setGoals((prev) =>
        prev.map((item) => (item.id === g.id ? { ...item, isPublic: updated.isPublic } : item))
      );
      setSuccess(
        updated.isPublic
          ? `"${g.name}" is now shown on your public profile.`
          : `"${g.name}" is private again.`
      );
    } catch {
      setFormError("Couldn't change that goal's visibility. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function save() {
    const found = validate(name, target, deadline);
    setErrors(found);
    setFormError("");
    setSuccess("");
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const response = editingId
        ? await apiFetch(`/api/features/goals/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify({ name: name.trim(), targetValue: Number(target), deadline }),
          })
        : await apiFetch("/api/features/goals", {
            method: "POST",
            body: JSON.stringify({
              name: name.trim(),
              targetValue: Number(target),
              targetUnit: unit,
              category,
              deadline,
            }),
          });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
          resetForm();
          setFormError("That goal no longer exists.");
          await refresh();
        } else if (/deadline/i.test(data.message ?? "")) setErrors({ deadline: data.message });
        else setFormError(data.message || "Couldn't save your goal. Please try again.");
        return;
      }
      const wasEditing = !!editingId;
      resetForm();
      setSuccess(
        wasEditing ? "Goal updated." : "Goal created. It's private and saved to your list below."
      );
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
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <View style={[s.card, !!editingId && s.cardEditing]}>
          <Text style={s.heading}>{editingId ? "Edit goal" : "Create a sustainability goal"}</Text>
          <Text style={s.help}>
            {editingId
              ? "Change the name, target or deadline. The unit and what counts stay the same."
              : "Make a measurable commitment. New goals are private by default; share them from your list below."}
          </Text>

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
              <TouchableOpacity
                key={u}
                style={[s.choice, unit === u && s.selected, !!editingId && unit !== u && s.choiceLocked]}
                onPress={() => setUnit(u)}
                disabled={!!editingId}
              >
                <Text style={[s.choiceText, unit === u && s.selectedText]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>What counts</Text>
          <View style={s.units}>
            {([null, ...CATEGORIES] as (Category | null)[]).map((c) => {
              const selected = category === c;
              return (
                <TouchableOpacity
                  key={c ?? "all"}
                  style={[s.choice, selected && s.selected, !!editingId && !selected && s.choiceLocked]}
                  onPress={() => setCategory(c)}
                  disabled={!!editingId}
                >
                  <Text style={[s.choiceText, selected && s.selectedText]}>{c ?? "Everything"}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!editingId && (
            <Text style={s.unitHint}>
              {(() => {
                const what = category ? `${category} activities` : "activities";
                if (unit === "kg CO₂e") {
                  return category
                    ? `An emissions budget: keep your ${category} emissions at or below this many kg by the deadline.`
                    : "An emissions budget: keep your total emissions at or below this many kg by the deadline.";
                }
                return unit === "activities"
                  ? `Log at least this many ${what} by the deadline.`
                  : `Log ${category ? `a ${category} activity` : "something"} on at least this many different days by the deadline.`;
              })()}
            </Text>
          )}

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

          <TouchableOpacity style={[s.button, saving && { opacity: 0.5 }]} disabled={saving} onPress={save}>
            <Text style={s.buttonText}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Goal"}
            </Text>
          </TouchableOpacity>
          {!!editingId && (
            <TouchableOpacity style={s.cancelBtn} onPress={resetForm} disabled={saving}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
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
          goals.map((g) => {
            const p = g.progress ?? null;
            const st = p ? STATUS[p.status] : undefined;
            // Fall back to working out days left here if the server didn't send it.
            const daysLeft =
              p?.daysLeft ??
              Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000));
            const barColor = !p
              ? UI.green
              : p.status === "over_budget"
                ? RED
                : p.status === "achieved"
                  ? UI.green
                  : p.status === "missed"
                    ? "#9CA3AF"
                    : p.kind === "budget"
                      ? "#F9A825"
                      : UI.green;
            return (
              <View key={g.id} style={[s.goal, editingId === g.id && s.goalEditing]}>
                <View style={s.goalTop}>
                  <View style={s.goalIcon}>
                    <Ionicons name="flag-outline" size={18} color={UI.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.goalName}>{g.name}</Text>
                    <Text style={s.countsText}>{countsLabel(g.category)}</Text>
                    <Text style={s.help}>
                      Due {g.deadline.slice(0, 10)}
                      {daysLeft > 0 ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : " · Ended"}
                      {g.isPublic ? " · Public" : " · Private"}
                    </Text>
                  </View>
                  {st && (
                    <View style={[s.statusChip, { backgroundColor: st.bg }]}>
                      <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  )}
                </View>

                {p ? (
                  <>
                    <View
                      style={s.barTrack}
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: 100, now: p.percent }}
                    >
                      <View style={[s.barFill, { width: `${p.percent}%`, backgroundColor: barColor }]} />
                    </View>
                    <View style={s.progressRow}>
                      <Text style={s.progressText}>{progressText({ ...g, progress: p })}</Text>
                      <Text style={s.progressPct}>{p.percent}%</Text>
                    </View>
                  </>
                ) : (
                  <Text style={[s.progressText, { marginTop: 12 }]}>
                    Target: {fmt(g.targetValue)} {g.targetUnit}
                  </Text>
                )}

                <View style={s.goalActions}>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => toggleShare(g)}
                    disabled={busyId === g.id}
                    accessibilityLabel={
                      g.isPublic
                        ? `Make ${g.name} private`
                        : `Share ${g.name} on your public profile`
                    }
                  >
                    <Ionicons
                      name={g.isPublic ? "eye-off-outline" : "share-outline"}
                      size={16}
                      color={UI.green}
                    />
                    <Text style={[s.actionText, s.shareText]}>
                      {busyId === g.id
                        ? "…"
                        : g.isPublic
                          ? "Make private"
                          : "Share"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => startEdit(g)}
                    disabled={busyId === g.id}
                    accessibilityLabel={`Edit ${g.name}`}
                  >
                    <Ionicons name="create-outline" size={16} color={UI.ink} />
                    <Text style={s.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => remove(g)}
                    disabled={busyId === g.id}
                    accessibilityLabel={`Delete ${g.name}`}
                  >
                    <Ionicons name="trash-outline" size={16} color={RED} />
                    <Text style={[s.actionText, { color: RED }]}>
                      {busyId === g.id ? "Deleting…" : "Delete"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
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
  goal: { backgroundColor: UI.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: "transparent", ...cardShadow },
  goalEditing: { borderColor: UI.green },
  goalTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11.5, fontWeight: "700" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#EEF0EE", marginTop: 14, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  progressText: { fontSize: 13, color: UI.ink, fontWeight: "500" },
  progressPct: { fontSize: 13, color: UI.muted, fontWeight: "600" },
  goalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: UI.hairline,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#F5F6F5" },
  actionText: { fontSize: 13.5, fontWeight: "600", color: UI.ink },
  shareText: { color: UI.green },
  cardEditing: { borderWidth: 1.5, borderColor: UI.green },
  choiceLocked: { opacity: 0.4 },
  countsText: { fontSize: 12.5, color: UI.green, fontWeight: "600", marginBottom: 1 },
  unitHint: { fontSize: 12.5, color: UI.muted, marginTop: 8, lineHeight: 18 },
  cancelBtn: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 6 },
  cancelText: { fontSize: 15, fontWeight: "600", color: UI.muted },
  goalIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: UI.greenSoft, alignItems: "center", justifyContent: "center" },
  goalName: { fontSize: 16, fontWeight: "700", color: UI.ink, marginBottom: 2 },
});
