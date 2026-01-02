// app/sessions/screens/request/components/MentorCard.tsx
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { COLORS } from "../styles";

function initialsFromName(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "M";
  const parts = clean.split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "M";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

// UI-only helper: avoid showing "111111" as a name
function looksLikeIdOrNumber(name: string) {
  const n = name.trim();
  if (!n) return false;
  const digitsOnly = /^\d+$/.test(n);
  if (digitsOnly) return true;
  if (n.length <= 2) return true;
  return false;
}

export default function MentorCard({
  mentorName,
  mentorId,
  onChangeMentor,
  matchedSkill, // ✅ optional: pass skill if you have it (UI-only)
}: {
  mentorName?: string;
  mentorId?: string;
  onChangeMentor?: () => void;
  matchedSkill?: string;
}) {
  const rawName = String(mentorName || "").trim();
  const rawSkill = String(matchedSkill || "").trim();

  const title = useMemo(() => {
    if (!rawName) return "Selected mentor";
    if (looksLikeIdOrNumber(rawName)) return "Selected mentor";
    return rawName;
  }, [rawName]);

  const badge = useMemo(() => {
    if (!rawName || looksLikeIdOrNumber(rawName)) return "M";
    return initialsFromName(rawName);
  }, [rawName]);

  // ✅ short, useful, and contextual (no extra logic)
  const reason = useMemo(() => {
    const s = rawSkill.trim();
    if (!s) return "Recommended based on your request.";
    return `Recommended for learning ${s}.`;
  }, [rawSkill]);

  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 16,
        padding: 14,
      }}
      accessibilityRole="summary"
      accessibilityLabel={`Selected mentor: ${title}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ color: "#FED7AA", fontWeight: "900" }}>{badge}</Text>
        </View>

        <View style={{ flex: 1 }}>
          {/* ✅ keep small label, but the main focus is the name */}
          <Text
            style={{ color: COLORS.muted, fontWeight: "900", fontSize: 12 }}
          >
            Selected mentor
          </Text>

          {/* ✅ show name (not "Selected mentor" in the middle) */}
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 16, // slightly stronger for clarity
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {looksLikeIdOrNumber(rawName) ? "Mentor" : title}
          </Text>

          {/* ✅ replace generic sentence with a short useful one */}
          <Text
            style={{
              color: COLORS.hint,
              marginTop: 6,
              fontSize: 12,
              fontWeight: "800",
            }}
            numberOfLines={2}
          >
            {reason}
          </Text>
        </View>

        {onChangeMentor ? (
          <Pressable
            onPress={onChangeMentor}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Change mentor"
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.bg,
              },
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Text
              style={{ color: COLORS.text, fontWeight: "900", fontSize: 12 }}
            >
              Change
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ marginTop: 10 }}>
        <Text style={{ color: COLORS.tip, fontWeight: "800", fontSize: 12 }}>
          You can edit the topic and time before sending.
        </Text>
      </View>
    </View>
  );
}
