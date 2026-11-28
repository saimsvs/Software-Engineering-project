
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
};

function parseDate(value?: string): Date {
  if (!value) return new Date();

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function ChallengeDateInput({
  value,
  onChange,
  min,
}: Props) {
  const [showIOSPicker, setShowIOSPicker] = useState(false);

  const selectedDate = parseDate(value);
  const minimumDate = min ? parseDate(min) : undefined;

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: "date",
        minimumDate,
        onChange: (event, date) => {
          if (event.type === "set" && date) {
            onChange(formatDate(date));
          }
        },
      });
    } else {
      setShowIOSPicker((previous) => !previous);
    }
  };

  return (
    <View>
      <Pressable
        style={styles.input}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel="Select date"
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value || "Tap to select a date"}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </Pressable>

      {Platform.OS === "ios" && showIOSPicker && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            onChange={(_event, date) => {
              if (date) {
                onChange(formatDate(date));
              }
            }}
          />

          <Pressable
            style={styles.doneButton}
            onPress={() => setShowIOSPicker(false)}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    color: "#222",
    fontSize: 15,
  },
  placeholder: {
    color: "#888",
    fontSize: 15,
  },
  calendarIcon: {
    fontSize: 19,
  },
  pickerContainer: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    marginTop: 8,
    padding: 8,
  },
  doneButton: {
    padding: 12,
    alignItems: "center",
  },
  doneText: {
    color: "#26734D",
    fontWeight: "700",
    fontSize: 16,
  },
});
