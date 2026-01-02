import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type Props = { visible: boolean };

export default function TopLoadingHint({ visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.pill}>
        <ActivityIndicator />
        <Text style={styles.txt}>Loading older…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 10, alignItems: "center" },
  pill: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  txt: { color: "#94A3B8", fontWeight: "800", fontSize: 12 },
});
