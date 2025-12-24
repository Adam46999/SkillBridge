// app/weekly-availability/TimeField.tsx
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function normalizeTimeInput(raw: string): string {
  let s = raw.replace(/[^\d:]/g, "");

  const digitsOnly = s.replace(/:/g, "");
  if (!s.includes(":") && digitsOnly.length >= 3) {
    const hh = digitsOnly.slice(0, 2);
    const mm = digitsOnly.slice(2, 4);
    s = `${hh}:${mm}`;
  }

  if (s.length > 5) s = s.slice(0, 5);

  if (s.includes(":")) {
    const [hhRaw = "", mmRaw = ""] = s.split(":");
    const hh = hhRaw.slice(0, 2);
    const mm = mmRaw.slice(0, 2);
    s = `${hh}:${mm}`;
  }

  return s;
}

function isValidPartialTime(v: string): boolean {
  if (v === "") return true;
  if (!/^\d{0,2}(:\d{0,2})?$/.test(v)) return false;

  const [hhStr, mmStr] = v.split(":");
  if (hhStr.length > 0) {
    const hh = Number(hhStr);
    if (!Number.isFinite(hh) || hh > 23) return false;
  }
  if (mmStr !== undefined && mmStr.length > 0) {
    const mm = Number(mmStr);
    if (!Number.isFinite(mm) || mm > 59) return false;
  }
  return true;
}

export default function TimeField({
  label,
  value,
  onChange,
  placeholder = "HH:MM",
  disabled = false,
}: Props) {
  const [local, setLocal] = useState<string>(value ?? "");

  // ✅ الصحيح: side-effect -> useEffect
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  const onTextChange = (txt: string) => {
    const normalized = normalizeTimeInput(txt);
    if (!isValidPartialTime(normalized)) return;

    setLocal(normalized);
    onChange(normalized);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        value={local}
        onChangeText={onTextChange}
        placeholder={placeholder}
        editable={!disabled}
        keyboardType={Platform.select({
          ios: "numbers-and-punctuation",
          android: "numeric",
          default: "numeric",
        })}
        style={[styles.input, disabled && styles.inputDisabled]}
        placeholderTextColor="#64748B"
        maxLength={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  label: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "#0B1220",
    color: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: "700",
  },
  inputDisabled: {
    opacity: 0.6,
  },
});
