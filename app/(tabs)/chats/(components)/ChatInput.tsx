import React, { useCallback, useMemo } from "react";
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";

type Props = {
  value: string;
  sending: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
};

export default function ChatInput({ value, sending, onChange, onSend }: Props) {
  const canSend = useMemo(
    () => value.trim().length > 0 && !sending,
    [value, sending]
  );

  const onKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      // Web behavior: Enter sends, Shift+Enter newline
      if (Platform.OS !== "web") return;

      const key = e?.nativeEvent?.key;
      // RN web: shiftKey exists on nativeEvent in many builds but not typed
      const shift = !!(e as any)?.nativeEvent?.shiftKey;

      if (key === "Enter" && !shift) {
        (e as any)?.preventDefault?.();
        if (canSend) onSend();
      }
    },
    [canSend, onSend]
  );

  return (
    <View style={styles.bar}>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Type a message…"
          placeholderTextColor="#64748B"
          style={styles.input}
          multiline
          maxLength={4000}
          accessibilityLabel="Message input"
          returnKeyType={Platform.OS === "ios" ? "default" : "send"}
          blurOnSubmit={false}
          onKeyPress={onKeyPress}
        />
      </View>

      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={({ pressed }) => [
          styles.sendBtn,
          canSend ? styles.sendOn : styles.sendOff,
          pressed && canSend ? { opacity: 0.92 } : null,
        ]}
        hitSlop={10}
      >
        <Text style={[styles.sendText, !canSend ? { opacity: 0.85 } : null]}>
          {sending ? "…" : "Send"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#0B1120",
    backgroundColor: "#020617",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },

  inputWrap: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#0B1120",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  input: {
    color: "#E5E7EB",
    fontWeight: "700",
    minHeight: 42,
    maxHeight: 140,
  },

  sendBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  sendOn: { backgroundColor: "#F97316", borderColor: "#FB923C" },
  sendOff: { backgroundColor: "#334155", borderColor: "#475569" },

  sendText: { color: "#111827", fontWeight: "900" },
});
