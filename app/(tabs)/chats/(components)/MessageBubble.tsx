import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChatMessage } from "../../../../lib/chat/api";

type Props = {
  item: ChatMessage;
  mine: boolean;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ item, mine }: Props) {
  const time = useMemo(
    () => formatTime(String((item as any)?.createdAt || "")),
    [item]
  );

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        style={[styles.bubble, mine ? styles.mine : styles.theirs]}
        accessibilityRole="text"
      >
        <Text style={[styles.text, mine ? styles.textMine : styles.textTheirs]}>
          {item.text}
        </Text>

        <View style={styles.metaRow}>
          <Text
            style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}
          >
            {time}
          </Text>
          {mine ? <Text style={styles.tick}>✓</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", marginVertical: 6, flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },

  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },

  mine: { backgroundColor: "#F97316", borderColor: "#FB923C" },
  theirs: { backgroundColor: "#0B1120", borderColor: "#111827" },

  text: { fontWeight: "800", fontSize: 14, lineHeight: 20 },
  textMine: { color: "#111827" },
  textTheirs: { color: "#E5E7EB" },

  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  time: { color: "rgba(17,24,39,0.75)", fontSize: 11, fontWeight: "900" },
  tick: { color: "rgba(17,24,39,0.75)", fontSize: 12, fontWeight: "900" },
  timeMine: {
    color: "rgba(17,24,39,0.75)",
  },
  timeTheirs: {
    color: "#94A3B8",
  },
});
