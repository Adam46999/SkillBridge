// app/sessions/screens/request/components/StepNote.tsx
import React from "react";
import { Text, TextInput, View } from "react-native";
import { COLORS, fieldBase } from "../styles";
import { Hint, Label } from "./UI";

type Props = {
  note: string;
  onChangeNote: (v: string) => void;
};

export default function StepNote({ note, onChangeNote }: Props) {
  return (
    <View style={{ gap: 10 }}>
      <Label>Note (optional)</Label>

      <TextInput
        value={note}
        onChangeText={onChangeNote}
        placeholder="Anything the mentor should know before the session…"
        placeholderTextColor={COLORS.hint}
        multiline
        style={{
          ...fieldBase,
          minHeight: 120,
          textAlignVertical: "top",
        }}
        accessibilityLabel="Optional note for the mentor"
      />

      {/* Soft guidance instead of silence */}
      <Hint>
        Optional • Share goals, questions, or anything important to prepare.
      </Hint>

      {/* Character hint (UI-only, no limits enforced) */}
      <Text
        style={{
          alignSelf: "flex-end",
          color: COLORS.muted,
          fontSize: 11,
          fontWeight: "800",
        }}
      >
        {note.length} characters
      </Text>
    </View>
  );
}
