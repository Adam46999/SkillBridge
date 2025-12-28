// app/weekly-availability/SaveBar.tsx
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  lastSavedText?: string;
};

export default function SaveBar({
  visible,
  saving,
  onSave,
  onDiscard,
  lastSavedText,
}: Props) {
  if (!visible) return null;

  const disabled = !!saving;

  return (
    <View
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#1E293B",
        backgroundColor: "#0B1120",
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 13 }}>
            Unsaved changes
          </Text>
          <Text
            style={{
              color: "#94A3B8",
              fontSize: 11,
              marginTop: 3,
              lineHeight: 14,
            }}
          >
            {lastSavedText ? `Last saved: ${lastSavedText}` : "Not saved yet"}
          </Text>
        </View>

        <Pressable
          onPress={onDiscard}
          disabled={disabled}
          style={({ pressed }) => [
            {
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#334155",
              backgroundColor: "#020617",
              opacity: disabled ? 0.6 : 1,
            },
            pressed && !disabled ? { opacity: 0.85 } : null,
          ]}
        >
          <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
            Discard
          </Text>
        </Pressable>

        <Pressable
          onPress={onSave}
          disabled={disabled}
          style={({ pressed }) => [
            {
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: "#22C55E",
              opacity: disabled ? 0.65 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            },
            pressed && !disabled ? { opacity: 0.9 } : null,
          ]}
        >
          {saving ? <ActivityIndicator /> : null}
          <Text style={{ color: "#022C22", fontWeight: "900", fontSize: 12 }}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
