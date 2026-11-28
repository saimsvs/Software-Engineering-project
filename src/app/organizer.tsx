
import { ACTIVITIES } from "@/data/activities";
import ChallengeDateInput from "@/components/challenge-date-input";
import { apiFetch } from "@/utils/api";
import { clearToken } from "@/utils/storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type TargetDirection = "at_least" | "at_most";
type ChallengeStatus = "upcoming" | "active" | "completed";

type Challenge = {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  targetDirection?: TargetDirection;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  activityRules?: {
    activityIds?: string[];
    categories?: string[];
    instructions?: string;
  };
};

const CATEGORIES = ["Transport", "Energy", "Food", "Waste"] as const;
const BASE_UNITS = ["activities", "days"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    globalThis.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function parseLocalDate(value: string, endOfDay = false): Date | null {
  if (!DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function labelForUnit(unit: string) {
  if (unit === "activities") return "Activities";
  if (unit === "days") return "Days";
  return unit;
}

export default function OrganizerScreen() {
  const router = useRouter();

  // ---------------- FORM STATE ----------------

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("activities");
  const [targetDirection, setTargetDirection] =
    useState<TargetDirection>("at_least");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedActivityIds, setSelectedActivityIds] =
    useState<string[]>([]);

  const [instructions, setInstructions] = useState("");

  // ---------------- UI STATE ----------------

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------------- ACTIVITY SELECTION ----------------

  const selectedActivities = useMemo(
    () =>
      ACTIVITIES.filter((activity) =>
        selectedActivityIds.includes(activity.id)
      ),
    [selectedActivityIds]
  );

  const availableUnits = useMemo(() => {
    const units = [
      ...new Set(selectedActivities.map((activity) => activity.unit)),
    ];

    return [
      ...BASE_UNITS,
      ...(selectedActivities.length > 0 && units.length === 1
        ? units
        : []),
    ];
  }, [selectedActivities]);

  // If the selected activities change and the current unit
  // becomes incompatible, switch to Activities.
  useEffect(() => {
    if (!availableUnits.includes(targetUnit)) {
      setTargetUnit("activities");
    }
  }, [availableUnits, targetUnit]);

  const toggleActivity = (activityId: string) => {
    setSelectedActivityIds((current) =>
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId]
    );

    setFormError("");
  };

  // ---------------- LOAD CHALLENGES ----------------

  const loadChallenges = useCallback(async () => {
    setLoadingList(true);
    setListError("");

    try {
      const response = await apiFetch("/api/challenges");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load challenges");
      }

      setChallenges(
        Array.isArray(data.challenges) ? data.challenges : []
      );
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "Could not load challenges"
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  // ---------------- RESET FORM ----------------

  const resetForm = () => {
    setName("");
    setDescription("");
    setTargetValue("");
    setTargetUnit("activities");
    setTargetDirection("at_least");
    setStartDate("");
    setEndDate("");
    setSelectedActivityIds([]);
    setInstructions("");
    setFormError("");
  };

  // ---------------- CREATE CHALLENGE ----------------

  const createChallenge = async () => {
    if (saving) return;

    setFormError("");
    setSuccess("");

    if (
      !name.trim() ||
      !description.trim() ||
      !targetValue.trim() ||
      !startDate ||
      !endDate ||
      !instructions.trim() ||
      selectedActivityIds.length === 0
    ) {
      setFormError(
        "Please complete every required field and select at least one activity."
      );
      return;
    }

    const target = Number(targetValue);

    if (!Number.isFinite(target) || target <= 0) {
      setFormError("Enter a target greater than zero.");
      return;
    }

    if (
      ["activities", "days"].includes(targetUnit) &&
      !Number.isInteger(target)
    ) {
      setFormError(
        "Activities and Days targets must be whole numbers."
      );
      return;
    }

    if (!availableUnits.includes(targetUnit)) {
      setFormError(
        "The selected target unit is not compatible with the selected activities."
      );
      return;
    }

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate, true);

    if (!start || !end || end <= start) {
      setFormError(
        "Please select valid dates. The end date must be after the start date."
      );
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch("/api/challenges", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          targetValue: target,
          targetUnit,
          targetDirection,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          activityRules: {
            activityIds: selectedActivityIds,
            instructions: instructions.trim(),
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details = data.fieldErrors
          ? Object.values(data.fieldErrors)
              .flatMap((value) =>
                Array.isArray(value) ? value : [value]
              )
              .filter(Boolean)
              .join("; ")
          : "";

        throw new Error(
          details || data.message || "Could not create challenge"
        );
      }

      resetForm();
      setSuccess("Challenge created successfully!");

      await loadChallenges();

      notify("Success", "Challenge created successfully!");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------- LOGOUT ----------------

  const handleLogout = async () => {
    try {
      await clearToken();
      router.replace("/login");
    } catch {
      notify("Logout failed", "Please try again.");
    }
  };

  // ---------------- SCREEN ----------------

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Organizer Dashboard</Text>
          <Text style={styles.subtitle}>
            Create challenges for CarbonTrail users.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* CREATE CHALLENGE FORM */}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Challenge</Text>

        <Text style={styles.helpText}>
          Fields marked * are required.
        </Text>

        {/* NAME */}

        <Text style={styles.label}>Challenge Name *</Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. Meatless Week"
          value={name}
          onChangeText={setName}
          maxLength={120}
        />

        {/* DESCRIPTION */}

        <Text style={styles.label}>Description *</Text>

        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Describe the challenge"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        {/* QUALIFYING ACTIVITIES */}

        <Text style={styles.label}>Qualifying Activities *</Text>

        <Text style={styles.helpText}>
          Select which logged activities count toward this challenge.
        </Text>

        {CATEGORIES.map((category) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {category}
            </Text>

            <View style={styles.chips}>
              {ACTIVITIES.filter(
                (activity) => activity.category === category
              ).map((activity) => {
                const selected = selectedActivityIds.includes(
                  activity.id
                );

                return (
                  <TouchableOpacity
                    key={activity.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleActivity(activity.id)}
                    style={[
                      styles.chip,
                      selected && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {selected ? "✓ " : ""}
                      {activity.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.helpText}>
          {selectedActivityIds.length} qualifying{" "}
          {selectedActivityIds.length === 1
            ? "activity"
            : "activities"}{" "}
          selected
        </Text>

        {/* TARGET VALUE */}

        <Text style={styles.label}>Target *</Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. 7"
          keyboardType="decimal-pad"
          value={targetValue}
          onChangeText={setTargetValue}
        />

        {/* TARGET DIRECTION */}

        <Text style={styles.label}>Target Direction *</Text>

        <View style={styles.chips}>
          {(
            [
              { value: "at_least", label: "At least" },
              { value: "at_most", label: "At most" },
            ] as const
          ).map((option) => {
            const selected =
              targetDirection === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                onPress={() =>
                  setTargetDirection(option.value)
                }
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.helpText}>
          {targetDirection === "at_least"
            ? "Participants must reach or exceed this target."
            : "Participants must stay at or below this limit during the challenge."}
        </Text>

        {/* TARGET UNIT */}

        <Text style={styles.label}>Target Unit *</Text>

        <View style={styles.chips}>
          {availableUnits.map((unit) => {
            const selected = targetUnit === unit;

            return (
              <TouchableOpacity
                key={unit}
                onPress={() => setTargetUnit(unit)}
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {labelForUnit(unit)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.helpText}>
          Quantity units appear only when all selected
          activities use the same unit.
          Activities counts logs; Days counts distinct
          days with qualifying logs.
        </Text>

        {/* DATES */}

        <Text style={styles.label}>Start Date *</Text>

        <ChallengeDateInput
          value={startDate}
          onChange={setStartDate}
        />

        <Text style={styles.label}>End Date *</Text>

        <ChallengeDateInput
          value={endDate}
          onChange={setEndDate}
          min={startDate || undefined}
        />

        {/* INSTRUCTIONS */}

        <Text style={styles.label}>
          Rules / Instructions *
        </Text>

        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Explain what participants need to do"
          value={instructions}
          onChangeText={setInstructions}
          multiline
          textAlignVertical="top"
        />

        {/* MESSAGES */}

        {!!formError && (
          <Text style={styles.error}>{formError}</Text>
        )}

        {!!success && (
          <Text style={styles.success}>{success}</Text>
        )}

        {/* SUBMIT */}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            saving && styles.disabledButton,
          ]}
          onPress={createChallenge}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              Create Challenge
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* EXISTING CHALLENGES */}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>
          Existing Challenges
        </Text>

        <TouchableOpacity
          onPress={() => void loadChallenges()}
          disabled={loadingList}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loadingList ? (
        <ActivityIndicator color="#228B5A" />
      ) : listError ? (
        <Text style={styles.error}>{listError}</Text>
      ) : challenges.length === 0 ? (
        <Text style={styles.emptyText}>
          No challenges have been created yet.
        </Text>
      ) : (
        challenges.map((challenge) => (
          <View
            key={challenge.id}
            style={styles.challengeCard}
          >
            <View style={styles.challengeHeading}>
              <Text style={styles.challengeName}>
                {challenge.name}
              </Text>

              <Text style={styles.status}>
                {challenge.status.toUpperCase()}
              </Text>
            </View>

            <Text style={styles.description}>
              {challenge.description}
            </Text>

            <Text style={styles.challengeMeta}>
              Target:{" "}
              {challenge.targetDirection === "at_most"
                ? "At most"
                : "At least"}{" "}
              {challenge.targetValue}{" "}
              {labelForUnit(challenge.targetUnit)}
            </Text>

            <Text style={styles.challengeMeta}>
              {challenge.startDate.slice(0, 10)} to{" "}
              {challenge.endDate.slice(0, 10)}
            </Text>

            {!!challenge.activityRules?.activityIds?.length && (
              <Text style={styles.challengeMeta}>
                Activities:{" "}
                {challenge.activityRules.activityIds
                  .map(
                    (id) =>
                      ACTIVITIES.find(
                        (activity) => activity.id === id
                      )?.name ?? id
                  )
                  .join(", ")}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ---------------- STYLES ----------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7F5",
  },

  content: {
    padding: 20,
    paddingBottom: 52,
    gap: 14,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
  },

  headerCopy: {
    flex: 1,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#1B2B22",
  },

  subtitle: {
    fontSize: 13,
    color: "#657067",
    marginTop: 4,
  },

  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#1B2B22",
  },

  logoutText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4EAE5",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B2B22",
  },

  label: {
    fontWeight: "700",
    fontSize: 14,
    color: "#263B2C",
    marginTop: 17,
    marginBottom: 8,
  },

  helpText: {
    fontSize: 12,
    color: "#657067",
    lineHeight: 18,
    marginTop: 5,
  },

  input: {
    borderWidth: 1,
    borderColor: "#D5DFD7",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
    color: "#1B2B22",
    fontSize: 15,
  },

  multiline: {
    minHeight: 84,
  },

  categorySection: {
    marginTop: 14,
  },

  categoryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#263B2C",
    marginBottom: 8,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1DAD2",
    backgroundColor: "#FFFFFF",
  },

  chipSelected: {
    borderColor: "#228B5A",
    backgroundColor: "#E3F4E9",
  },

  chipText: {
    color: "#374151",
    fontSize: 13,
  },

  chipTextSelected: {
    color: "#166534",
    fontWeight: "700",
  },

  primaryButton: {
    marginTop: 22,
    borderRadius: 12,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#228B5A",
  },

  disabledButton: {
    opacity: 0.6,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  error: {
    color: "#B42318",
    backgroundColor: "#FEF3F2",
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },

  success: {
    color: "#166534",
    backgroundColor: "#E3F4E9",
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  refreshText: {
    color: "#228B5A",
    fontWeight: "700",
  },

  emptyText: {
    color: "#657067",
    textAlign: "center",
    padding: 18,
  },

  challengeCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderColor: "#E4EAE5",
    borderWidth: 1,
    gap: 7,
  },

  challengeHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  challengeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1B2B22",
  },

  status: {
    fontSize: 10,
    fontWeight: "800",
    color: "#228B5A",
  },

  description: {
    fontSize: 14,
    color: "#425348",
  },

  challengeMeta: {
    fontSize: 12,
    color: "#657067",
  },
});
