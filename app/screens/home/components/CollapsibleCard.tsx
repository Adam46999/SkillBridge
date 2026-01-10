import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  icon?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export default function CollapsibleCard({
  title,
  icon,
  open,
  onToggle,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={styles.head} hitSlop={8}>
        <Text style={styles.headTitle}>
          {icon ? `${icon} ` : ""}
          {title}
        </Text>
        <Text style={styles.chev}>{open ? "▾" : "▸"}</Text>
      </Pressable>

      {open ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 16,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "900" },
  chev: { color: "#94A3B8", fontSize: 16, fontWeight: "900" },
});
