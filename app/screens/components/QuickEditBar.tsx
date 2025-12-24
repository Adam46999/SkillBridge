import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  onAvailability: () => void;
  onLearn: () => void;
  onTeach: () => void;
  onMatch: () => void;
};

function Pill({
  title,
  emoji,
  onPress,
  variant = "neutral",
}: {
  title: string;
  emoji: string;
  onPress: () => void;
  variant?: "neutral" | "primary";
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.pill,
        variant === "primary" ? styles.pillPrimary : styles.pillNeutral,
      ]}
    >
      <Text style={styles.pillEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.pillText,
          variant === "primary"
            ? styles.pillTextPrimary
            : styles.pillTextNeutral,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function QuickEditBar({
  onAvailability,
  onLearn,
  onTeach,
  onMatch,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Quick edit</Text>
        <Text style={styles.hint}>Avoid page hopping</Text>
      </View>

      <View style={styles.row}>
        <Pill title="Match" emoji="🧠" onPress={onMatch} variant="primary" />
        <Pill title="Availability" emoji="📅" onPress={onAvailability} />
      </View>

      <View style={styles.row}>
        <Pill title="Learn" emoji="📚" onPress={onLearn} />
        <Pill title="Teach" emoji="🧑‍🏫" onPress={onTeach} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { color: "#F9FAFB", fontSize: 14, fontWeight: "700" },
  hint: { color: "#64748B", fontSize: 11 },

  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  pill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillNeutral: { backgroundColor: "#0B1120", borderColor: "#334155" },
  pillPrimary: { backgroundColor: "#0F172A", borderColor: "#1D4ED8" },

  pillEmoji: { fontSize: 14 },
  pillText: { fontSize: 12, fontWeight: "700" },
  pillTextNeutral: { color: "#E5E7EB" },
  pillTextPrimary: { color: "#DBEAFE" },
});
