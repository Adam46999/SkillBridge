// app/weekly-availability/TimeField.tsx
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "./styles";

type Props = {
  label: string;
  value: string;
  onChange: (newTime: string) => void;
};

/**
 * Converts "HH:MM" → Date (safe default)
 */
function parseTimeToDate(time: string): Date {
  const d = new Date();
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);

  if (!isNaN(h) && !isNaN(m)) {
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(18, 0, 0, 0); // safe default
  }
  return d;
}

/**
 * Date → "HH:MM"
 */
function formatDateToTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

const TimeField: React.FC<Props> = ({ label, value, onChange }) => {
  /**
   * Memoized initial date so we never violate hooks rules
   */
  const initialDate = useMemo(() => parseTimeToDate(value), [value]);

  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(initialDate);

  const openPicker = () => {
    setTempDate(parseTimeToDate(value));
    setOpen(true);
  };

  const closePicker = () => setOpen(false);

  const confirmPicker = () => {
    onChange(formatDateToTime(tempDate));
    setOpen(false);
  };

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed") return;
    if (date) setTempDate(date);
  };

  /**
   * 🌐 WEB:
   * Simple numeric input, same visual language
   */
  if (Platform.OS === "web") {
    return (
      <View style={styles.timeFieldBox}>
        <Text style={styles.timeFieldLabel}>{label}</Text>
        <TextInput
          style={styles.timeFieldValue}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="18:00"
          placeholderTextColor="#64748B"
          accessibilityLabel={`${label} time input`}
        />
      </View>
    );
  }

  /**
   * 📱 MOBILE:
   * Button → Modal → DateTimePicker
   */
  return (
    <>
      <TouchableOpacity
        style={styles.timeFieldBox}
        onPress={openPicker}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Select ${label} time`}
      >
        <Text style={styles.timeFieldLabel}>{label}</Text>
        <Text style={styles.timeFieldValue}>{value}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose time</Text>

            <DateTimePicker
              value={tempDate}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handlePickerChange}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={closePicker}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmPicker}
                accessibilityRole="button"
              >
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default TimeField;
