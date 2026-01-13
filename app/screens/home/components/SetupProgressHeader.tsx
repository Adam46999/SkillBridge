import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  completed: number;
  total: number;
  learnCount: number;
  teachCount: number;
  daysSet: number;
  totalMin: number;
  qualityLabel: string;
  totalHuman: string;
};

export default function SetupProgressHeader({
  completed,
  total,
  learnCount,
  teachCount,
  daysSet,
  totalMin,
  qualityLabel,
  totalHuman,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Setup</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {completed}/{total}
          </Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Learn: {learnCount} · Availability:{" "}
        {totalMin > 0
          ? `${qualityLabel} (${daysSet}d, ${totalHuman})`
          : "Not set"}{" "}
        · Teach: {teachCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#E5E7EB", fontSize: 14, fontWeight: "900" },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },
  pillText: { color: "#E5E7EB", fontSize: 12, fontWeight: "900" },
  subtitle: { color: "#9CA3AF", fontSize: 12, marginTop: 8 },
});
