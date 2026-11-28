
import { ACTIVITIES } from "@/data/activities";
import { apiFetch } from "@/utils/api";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ChallengeDateInput from "./challenge-date-input";

type Challenge = {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  targetDirection?: "at_least" | "at_most";
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed";
  activityRules?: {
    activityIds?: string[];
    categories?: string[];
    instructions?: string;
  };
};

type Props = {
  challenge: Challenge;
  onChanged: () => Promise<void>;
};

function formatUnit(unit: string) {
  if (unit === "activities") return "Activities";
  if (unit === "days") return "Days";
  return unit;
}

function parseLocalDate(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

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

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong";
}

export default function ChallengeManagerCard({
  challenge,
  onChanged,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(challenge.name);
  const [description, setDescription] = useState(
    challenge.description
  );
  const [startDate, setStartDate] = useState(
    challenge.startDate.slice(0, 10)
  );
  const [endDate, setEndDate] = useState(
    challenge.endDate.slice(0, 10)
  );

  const canEdit = challenge.status !== "completed";
  const canDelete = challenge.status === "upcoming";
  const isUpcoming = challenge.status === "upcoming";

  const resetEdit = () => {
    setName(challenge.name);
    setDescription(challenge.description);
    setStartDate(challenge.startDate.slice(0, 10));
    setEndDate(challenge.endDate.slice(0, 10));
    setError("");
    setEditing(false);
  };

  const saveChanges = async () => {
    setError("");

    const changes: Record<string, string> = {};

    if (description.trim() !== challenge.description) {
      if (!description.trim()) {
        setError("Description cannot be empty.");
        return;
      }
      changes.description = description.trim();
    }

    if (isUpcoming) {
      if (name.trim() !== challenge.name) {
        if (!name.trim()) {
          setError("Challenge name cannot be empty.");
          return;
        }
        changes.name = name.trim();
      }

      const startChanged =
        startDate !== challenge.startDate.slice(0, 10);
      const endChanged =
        endDate !== challenge.endDate.slice(0, 10);

      if (startChanged || endChanged) {
        const start = startChanged
          ? parseLocalDate(startDate)
          : new Date(challenge.startDate);

        const end = endChanged
          ? parseLocalDate(endDate, true)
          : new Date(challenge.endDate);

        if (!start || !end || end <= start) {
          setError("End date must be after start date.");
          return;
        }

        if (start <= new Date()) {
          setError("An upcoming challenge must start in the future.");
          return;
        }

        if (startChanged) {
          changes.startDate = start.toISOString();
        }
        if (endChanged) {
          changes.endDate = end.toISOString();
        }
      }
    }

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    setBusy(true);

    try {
      const response = await apiFetch(
        `/api/challenges/${challenge.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(changes),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Could not update challenge"
        );
      }

      await onChanged();
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteChallenge = async () => {
    setBusy(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/challenges/${challenge.id}`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Could not delete challenge"
        );
      }

      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm(
        `Delete "${challenge.name}"? This cannot be undone.`
      );
      if (confirmed) void deleteChallenge();
      return;
    }

    Alert.alert(
      "Delete challenge?",
      `Delete "${challenge.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void deleteChallenge(),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.name}>{challenge.name}</Text>
        <Text style={styles.status}>
          {challenge.status.toUpperCase()}
        </Text>
      </View>

      {!editing ? (
        <>
          <Text style={styles.description}>
            {challenge.description}
          </Text>

          <Text style={styles.meta}>
            Target:{" "}
            {challenge.targetDirection === "at_most"
              ? "At most"
              : "At least"}{" "}
            {challenge.targetValue}{" "}
            {formatUnit(challenge.targetUnit)}
          </Text>

          <Text style={styles.meta}>
            {challenge.startDate.slice(0, 10)} to{" "}
            {challenge.endDate.slice(0, 10)}
          </Text>

          {!!challenge.activityRules?.activityIds?.length && (
            <Text style={styles.meta}>
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

          <View style={styles.actions}>
            {canEdit && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditing(true)}
                disabled={busy}
              >
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}

            {canDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={confirmDelete}
                disabled={busy}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      ) : (
        <View style={styles.form}>
          {isUpcoming && (
            <>
              <Text style={styles.label}>Challenge name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                editable={!busy}
              />
            </>
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            editable={!busy}
          />

          {isUpcoming && (
            <>
              <Text style={styles.label}>Start date</Text>
              <ChallengeDateInput
                value={startDate}
                onChange={setStartDate}
              />

              <Text style={styles.label}>End date</Text>
              <ChallengeDateInput
                value={endDate}
                onChange={setEndDate}
                min={startDate || undefined}
              />
            </>
          )}

          {challenge.status === "active" && (
            <Text style={styles.hint}>
              Active challenges allow description changes only.
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => void saveChanges()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={resetEdit}
              disabled={busy}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {busy && !editing && (
        <ActivityIndicator color="#228B5A" />
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderColor: "#E4EAE5",
    borderWidth: 1,
    gap: 8,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  name: {
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
  meta: {
    fontSize: 12,
    color: "#657067",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  editButton: {
    backgroundColor: "#E3F4E9",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  editText: {
    color: "#166534",
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#FEE4E2",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  deleteText: {
    color: "#B42318",
    fontWeight: "700",
  },
  form: {
    gap: 8,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#263B2C",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D5DFD7",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#FFFFFF",
    color: "#1B2B22",
    fontSize: 15,
  },
  multiline: {
    minHeight: 90,
  },
  hint: {
    fontSize: 12,
    color: "#657067",
  },
  saveButton: {
    backgroundColor: "#228B5A",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#EEF1EF",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelText: {
    color: "#374151",
    fontWeight: "700",
  },
  error: {
    color: "#B42318",
    backgroundColor: "#FEF3F2",
    padding: 12,
    borderRadius: 10,
  },
});
