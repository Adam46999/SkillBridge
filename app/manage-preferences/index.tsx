// app/manage-preferences/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_URL } from "../../lib/api";

type Preferences = {
  languages: string[];
  communicationModes: string[];
};

const LANGUAGE_OPTIONS = [
  "English",
  "Arabic",
  "Spanish",
  "French",
  "German",
  "Chinese",
  "Japanese",
  "Korean",
  "Portuguese",
  "Russian",
  "Italian",
  "Hindi",
];

const COMMUNICATION_OPTIONS = [
  "Video call",
  "Voice call",
  "Text chat",
  "Screen sharing",
  "Code review",
  "Pair programming",
];

export default function ManagePreferencesScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    languages: [],
    communicationModes: [],
  });
  const [customLanguage, setCustomLanguage] = useState("");
  const [customCommMode, setCustomCommMode] = useState("");

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const res = await fetch(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      const user = data?.user ?? data;

      setPreferences({
        languages: user?.preferences?.languages || [],
        communicationModes: user?.preferences?.communicationModes || [],
      });
    } catch (err: any) {
      console.error("Load preferences error:", err);
      Alert.alert("Error", err?.message || "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    setPreferences((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  const toggleCommunicationMode = (mode: string) => {
    setPreferences((prev) => ({
      ...prev,
      communicationModes: prev.communicationModes.includes(mode)
        ? prev.communicationModes.filter((m) => m !== mode)
        : [...prev.communicationModes, mode],
    }));
  };

  const addCustomLanguage = () => {
    const lang = customLanguage.trim();
    if (!lang) return;
    if (preferences.languages.includes(lang)) {
      Alert.alert("Already added", "This language is already in your list");
      return;
    }
    setPreferences((prev) => ({
      ...prev,
      languages: [...prev.languages, lang],
    }));
    setCustomLanguage("");
  };

  const addCustomCommMode = () => {
    const mode = customCommMode.trim();
    if (!mode) return;
    if (preferences.communicationModes.includes(mode)) {
      Alert.alert("Already added", "This mode is already in your list");
      return;
    }
    setPreferences((prev) => ({
      ...prev,
      communicationModes: [...prev.communicationModes, mode],
    }));
    setCustomCommMode("");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const res = await fetch(`${API_URL}/api/me/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }

      Alert.alert("Success", "Preferences saved successfully!");
      router.back();
    } catch (err: any) {
      console.error("Save preferences error:", err);
      Alert.alert("Error", err?.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Manage Preferences</Text>
          <Text style={styles.subtitle}>
            Set your language and communication preferences
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Languages</Text>
          <Text style={styles.sectionSub}>
            Select all languages you can communicate in
          </Text>
          <View style={styles.optionsGrid}>
            {LANGUAGE_OPTIONS.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.optionChip,
                  preferences.languages.includes(lang) &&
                    styles.optionChipActive,
                ]}
                onPress={() => toggleLanguage(lang)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.optionText,
                    preferences.languages.includes(lang) &&
                      styles.optionTextActive,
                  ]}
                >
                  {lang}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Show custom languages */}
            {preferences.languages
              .filter((lang) => !LANGUAGE_OPTIONS.includes(lang))
              .map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.optionChip, styles.optionChipActive]}
                  onPress={() => toggleLanguage(lang)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.optionText, styles.optionTextActive]}>
                    {lang} ✕
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Add custom language"
              placeholderTextColor="#64748B"
              value={customLanguage}
              onChangeText={setCustomLanguage}
              onSubmitEditing={addCustomLanguage}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addCustomLanguage}
              activeOpacity={0.85}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication Modes</Text>
          <Text style={styles.sectionSub}>
            Select your preferred ways to communicate with learners
          </Text>
          <View style={styles.optionsGrid}>
            {COMMUNICATION_OPTIONS.map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.optionChip,
                  preferences.communicationModes.includes(mode) &&
                    styles.optionChipActive,
                ]}
                onPress={() => toggleCommunicationMode(mode)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.optionText,
                    preferences.communicationModes.includes(mode) &&
                      styles.optionTextActive,
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Show custom communication modes */}
            {preferences.communicationModes
              .filter((mode) => !COMMUNICATION_OPTIONS.includes(mode))
              .map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.optionChip, styles.optionChipActive]}
                  onPress={() => toggleCommunicationMode(mode)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.optionText, styles.optionTextActive]}>
                    {mode} ✕
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Add custom communication mode"
              placeholderTextColor="#64748B"
              value={customCommMode}
              onChangeText={setCustomCommMode}
              onSubmitEditing={addCustomCommMode}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addCustomCommMode}
              activeOpacity={0.85}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, color: "#9CA3AF", fontSize: 14 },

  header: { marginBottom: 20 },
  backText: { fontSize: 14, color: "#60A5FA", marginBottom: 8 },
  title: { color: "#F9FAFB", fontSize: 24, fontWeight: "700", marginTop: 4 },
  subtitle: { color: "#94A3B8", fontSize: 13, marginTop: 6 },

  section: { marginBottom: 24 },
  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionSub: { color: "#94A3B8", fontSize: 12, marginBottom: 12 },

  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#020617",
  },
  optionChipActive: {
    backgroundColor: "#F97316",
    borderColor: "#F97316",
  },
  optionText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },

  customInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E5E7EB",
    fontSize: 13,
    backgroundColor: "#020617",
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#60A5FA",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  saveButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#10B981",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
