// app/manage-skills-to-teach/AddSkillToTeachForm.tsx
import React, { useMemo, useState } from "react";
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SkillChip } from "../manage-skills-to-learn/SkillChip";
import { Level, TEACH_LEVELS } from "./types";

type Props = {
  onAdd: (name: string, level?: Level) => Promise<void> | void;
  onAddFavorite: (name: string, level?: Level) => Promise<void> | void;
  isSaving: boolean;
  suggestionPool: string[];
  placeholderHint?: string;
};

const MAX_SUGGESTIONS = 10;

export default function AddSkillToTeachForm({
  onAdd,
  onAddFavorite,
  isSaving,
  suggestionPool,
  placeholderHint,
}: Props) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level>("Intermediate");

  const normalizedValue = value.trim();
  const showPlaceholder =
    placeholderHint || "e.g. Math tutoring, React, Guitar";

  const filteredSuggestions = useMemo(() => {
    const base = Array.isArray(suggestionPool) ? suggestionPool : [];
    if (!normalizedValue) return base.slice(0, MAX_SUGGESTIONS);

    const q = normalizedValue.toLowerCase();
    const starts = base.filter((s) => s.toLowerCase().startsWith(q));
    const contains = base.filter(
      (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q)
    );

    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [normalizedValue, suggestionPool]);

  const validate = () => {
    if (!normalizedValue) return "Please type a skill name first.";
    if (normalizedValue.length < 2) return "Skill name is too short.";
    return null;
  };

  const handleSubmit = async (favorite = false) => {
    const err = validate();
    if (err) {
      setLocalError(err);
      return;
    }

    setLocalError(null);

    try {
      if (favorite) await onAddFavorite(normalizedValue, selectedLevel);
      else await onAdd(normalizedValue, selectedLevel);

      setValue("");
      Keyboard.dismiss();
    } catch (e) {
      console.log("AddSkillToTeachForm submit error:", e);
    }
  };

  const handleClear = () => {
    setLocalError(null);
    setValue("");
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Add a custom teaching skill</Text>
        <Text style={styles.badge}>Optional</Text>
      </View>

      <Text style={styles.subtitle}>
        Add what you can teach and choose your level.
      </Text>

      <Text style={styles.label}>Level</Text>
      <View style={styles.levelRow}>
        {TEACH_LEVELS.slice(0, 4).map((lvl) => {
          const active = selectedLevel === lvl;
          return (
            <TouchableOpacity
              key={lvl}
              style={[styles.levelPill, active && styles.levelPillActive]}
              onPress={() => setSelectedLevel(lvl)}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.levelPillText,
                  active && styles.levelPillTextActive,
                ]}
              >
                {lvl}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.inputHeader}>
        <Text style={styles.label}>Skill name</Text>
        {!!value && (
          <TouchableOpacity
            onPress={handleClear}
            activeOpacity={0.85}
            disabled={isSaving}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={[styles.input, localError && styles.inputError]}
        placeholder={showPlaceholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={(t) => {
          setLocalError(null);
          setValue(t);
        }}
        autoCapitalize="sentences"
        returnKeyType="done"
        editable={!isSaving}
        onSubmitEditing={() => handleSubmit(false)}
      />

      {localError && <Text style={styles.errorText}>{localError}</Text>}

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            isSaving && { opacity: 0.7 },
          ]}
          onPress={() => handleSubmit(false)}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving..." : "Add skill"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            isSaving && { opacity: 0.7 },
          ]}
          onPress={() => handleSubmit(true)}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Add & favorite</Text>
        </TouchableOpacity>
      </View>

      {filteredSuggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Suggestions</Text>
            <Text style={styles.suggestionsHint}>Tap to fill the input</Text>
          </View>

          <View style={styles.suggestionsRow}>
            {filteredSuggestions.map((s) => (
              <SkillChip
                key={s}
                label={s}
                onPress={() => setValue(s)}
                compact
                disabled={isSaving}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 15, fontWeight: "800", color: "#111827" },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
    marginBottom: 6,
  },
  levelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  levelPillActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  levelPillText: { fontSize: 12, color: "#374151", fontWeight: "800" },
  levelPillTextActive: { color: "#ffffff" },

  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  clearText: { fontSize: 12, fontWeight: "800", color: "#2563eb" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  inputError: { borderColor: "#fca5a5", backgroundColor: "#fff1f2" },
  errorText: { fontSize: 12, color: "#b91c1c", marginTop: 6 },

  buttonsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: { backgroundColor: "#2563eb" },
  primaryButtonText: { color: "#f9fafb", fontSize: 13, fontWeight: "900" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#9ca3af",
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: { color: "#374151", fontSize: 13, fontWeight: "800" },

  suggestionsSection: { marginTop: 12 },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  suggestionsTitle: { fontSize: 12, color: "#6b7280", fontWeight: "800" },
  suggestionsHint: { fontSize: 11, color: "#9ca3af", fontWeight: "700" },
  suggestionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
