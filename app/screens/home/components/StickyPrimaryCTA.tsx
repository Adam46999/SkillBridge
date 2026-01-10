import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  visible: boolean;
  onPress: () => void;
  label?: string;
};

export default function StickyPrimaryCTA({
  visible,
  onPress,
  label = "Start: Find a mentor",
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.inner}>
        <TouchableOpacity
          style={styles.btn}
          onPress={onPress}
          activeOpacity={0.9}
        >
          <Text style={styles.text}>{label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  inner: {
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "#111827",
  },
  btn: {
    backgroundColor: "#F97316",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  text: { color: "#0B1120", fontWeight: "900", fontSize: 14 },
});
