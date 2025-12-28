// app/sessions/request.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { requestSession } from "./api/sessionsApi";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Accepts:
 * - date: "YYYY-MM-DD"
 * - time: "HH:MM"
 * Produces ISO string in local time.
 */
function buildISO(dateStr: string, timeStr: string): string | null {
  const d = String(dateStr || "").trim();
  const t = String(timeStr || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}$/.test(t)) return null;

  const [yy, mm, dd] = d.split("-").map((x) => Number(x));
  const [hh, mi] = t.split(":").map((x) => Number(x));

  if (![yy, mm, dd, hh, mi].every(Number.isFinite)) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  if (hh < 0 || hh > 23) return null;
  if (mi < 0 || mi > 59) return null;

  const dt = new Date(yy, mm - 1, dd, hh, mi, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;

  return dt.toISOString();
}

export default function RequestSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mentorId?: string;
    mentorName?: string;
    skill?: string;
    level?: string;
  }>();

  // Prefill from params if provided
  const mentorId = String(params.mentorId || "").trim();
  const mentorName = String(params.mentorName || "").trim();
  const defaultSkill = String(params.skill || "").trim();
  const defaultLevel = String(params.level || "").trim();

  const now = useMemo(() => new Date(), []);
  const defaultDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
  const defaultTime = `${pad2(Math.min(23, now.getHours() + 1))}:${pad2(
    now.getMinutes()
  )}`;

  const [skill, setSkill] = useState(defaultSkill);
  const [level, setLevel] = useState(defaultLevel || "Not specified");
  const [dateStr, setDateStr] = useState(defaultDate);
  const [timeStr, setTimeStr] = useState(defaultTime);
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!mentorId) return false;
    if (!skill.trim()) return false;
    return buildISO(dateStr, timeStr) !== null;
  }, [mentorId, skill, dateStr, timeStr]);

  const submit = async () => {
    if (!mentorId) {
      Alert.alert("Missing mentor", "Open this screen from a mentor profile.");
      return;
    }

    const iso = buildISO(dateStr, timeStr);
    if (!iso) {
      Alert.alert("Invalid date/time", "Use Date: YYYY-MM-DD and Time: HH:MM");
      return;
    }

    const trimmedSkill = skill.trim();
    if (!trimmedSkill) {
      Alert.alert("Missing skill", "Please enter a skill for the session.");
      return;
    }

    try {
      setBusy(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login" as any);
        return;
      }

      await requestSession(token, {
        mentorId,
        skill: trimmedSkill,
        level: String(level || "Not specified"),
        scheduledAt: iso,
        note: String(note || "").trim(),
      });

      Alert.alert("Requested ✅", "Your session request was sent.", [
        {
          text: "Go to sessions",
          onPress: () => router.replace("/sessions" as any),
        },
      ]);
    } catch (e: any) {
      Alert.alert("Request failed", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#020617" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={{ color: "#60A5FA", fontWeight: "900" }}>← Back</Text>
          </TouchableOpacity>

          <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 16 }}>
            Request session
          </Text>

          <View style={{ width: 54 }} />
        </View>

        <Text style={{ color: "#94A3B8", marginTop: 8, fontSize: 12 }}>
          {mentorName
            ? `Requesting with: ${mentorName}`
            : mentorId
            ? `Mentor selected`
            : `Open from a mentor profile to auto-fill mentorId.`}
        </Text>

        {/* Card */}
        <View
          style={{
            marginTop: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#1E293B",
            backgroundColor: "#0B1120",
            padding: 12,
            gap: 10,
          }}
        >
          <Field
            label="Skill"
            value={skill}
            onChangeText={setSkill}
            placeholder="e.g. React, Unity, AWS..."
          />

          <Field
            label="Level"
            value={level}
            onChangeText={setLevel}
            placeholder="Beginner / Intermediate / Advanced"
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Date (YYYY-MM-DD)"
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="2025-12-31"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Field
                label="Time (HH:MM)"
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="18:30"
              />
            </View>
          </View>

          <Field
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Anything the mentor should know..."
            multiline
            minHeight={76}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={submit}
          activeOpacity={0.85}
          disabled={!canSubmit || busy}
          style={{
            marginTop: 14,
            borderRadius: 999,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: !canSubmit || busy ? "#334155" : "#F97316",
            borderWidth: 1,
            borderColor: !canSubmit || busy ? "#475569" : "#FB923C",
          }}
        >
          {busy ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <ActivityIndicator />
              <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>
                Sending…
              </Text>
            </View>
          ) : (
            <Text style={{ color: "#111827", fontWeight: "900" }}>
              Send request
            </Text>
          )}
        </TouchableOpacity>

        {/* Hint */}
        <Text style={{ color: "#64748B", marginTop: 10, fontSize: 11 }}>
          Tip: the screen works best when opened with mentorId + skill
          prefilled.
        </Text>
      </ScrollView>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
}) {
  const { label, value, onChangeText, placeholder, multiline, minHeight } =
    props;

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "900" }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        multiline={multiline}
        style={{
          borderWidth: 1,
          borderColor: "#1F2937",
          backgroundColor: "#020617",
          color: "#E5E7EB",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: "700",
          minHeight: minHeight ?? 44,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
