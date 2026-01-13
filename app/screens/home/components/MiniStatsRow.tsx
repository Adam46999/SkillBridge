import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  xp: number;
  points: number;
  streak: number;
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.item}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default function MiniStatsRow({ xp, points, streak }: Props) {
  return (
    <View style={styles.wrap}>
      <Stat label="XP" value={xp} />
      <View style={styles.sep} />
      <Stat label="Points" value={points} />
      <View style={styles.sep} />
      <Stat label="Streak" value={streak} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  item: { flex: 1, alignItems: "center" },
  value: { color: "#F9FAFB", fontSize: 16, fontWeight: "900" },
  label: { color: "#94A3B8", fontSize: 11, fontWeight: "800", marginTop: 4 },
  sep: { width: 1, height: 26, backgroundColor: "#111827" },
});
