import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  label?: string;
  onPress: () => void;
};

export default function ViewProfileCTA({
  label = "View profile",
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.left}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.sub}>See and update your profile in one place</Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  left: { flex: 1, paddingRight: 10 },
  title: { color: "#F9FAFB", fontSize: 14, fontWeight: "700" },
  sub: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  right: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { color: "#60A5FA", fontSize: 18, fontWeight: "800" },
});
