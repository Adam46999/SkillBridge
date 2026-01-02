// app/sessions/screens/request/components/StepSchedule.tsx
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { COLORS, fieldBase } from "../styles";
import { Hint, Label } from "./UI";

type Props = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  onChangeDate: (v: string) => void;
  onChangeTime: (v: string) => void;
  errors?: { date?: string; time?: string };
  onQuickPick?: (preset: "today" | "tomorrow" | "plus30" | "plus60") => void;
};

export default function StepSchedule({
  date,
  time,
  onChangeDate,
  onChangeTime,
  errors,
  onQuickPick,
}: Props) {
  const quicks = useMemo(
    () => [
      { key: "today" as const, label: "Today" },
      { key: "tomorrow" as const, label: "Tomorrow" },
      { key: "plus30" as const, label: "+30 min" },
      { key: "plus60" as const, label: "+1 hour" },
    ],
    []
  );

  const hasQuick = !!onQuickPick;

  // ✅ UI-only: remember last clicked option so user "feels" selection
  const [lastPick, setLastPick] = useState<
    "today" | "tomorrow" | "plus30" | "plus60" | null
  >(null);

  const filled = !!date?.trim() && !!time?.trim();

  return (
    <View style={{ gap: 14 }}>
      {hasQuick ? (
        <View>
          <Label>Quick pick (recommended)</Label>

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            {quicks.map((q) => {
              const active = q.key === lastPick;

              return (
                <Pressable
                  key={q.key}
                  onPress={() => {
                    setLastPick(q.key); // ✅ visual confirmation
                    onQuickPick?.(q.key); // ✅ existing behavior
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Pick ${q.label}`}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? COLORS.orange : COLORS.border,
                      backgroundColor: active ? COLORS.card : COLORS.bg,
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? "#FED7AA" : COLORS.text,
                      fontWeight: "900",
                      fontSize: 12,
                    }}
                  >
                    {q.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ✅ actually useful feedback */}
          <Hint>
            {filled
              ? `Filled: ${date} • ${time}`
              : "Tap one option to fill date & time."}
          </Hint>
        </View>
      ) : null}

      <View>
        <Label>Date</Label>
        <TextInput
          value={date}
          onChangeText={(v) => {
            setLastPick(null); // typing means not a preset
            onChangeDate(v);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.hint}
          style={{
            ...fieldBase,
            borderColor: date?.trim()
              ? COLORS.orangeBorder
              : fieldBase.borderColor,
          }}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          accessibilityLabel="Date input YYYY-MM-DD"
        />
        {!!errors?.date && (
          <Text
            style={{ color: COLORS.danger, marginTop: 8, fontWeight: "900" }}
          >
            {errors.date}
          </Text>
        )}
      </View>

      <View>
        <Label>Time</Label>
        <TextInput
          value={time}
          onChangeText={(v) => {
            setLastPick(null);
            onChangeTime(v);
          }}
          placeholder="HH:MM (24h)"
          placeholderTextColor={COLORS.hint}
          style={{
            ...fieldBase,
            borderColor: time?.trim()
              ? COLORS.orangeBorder
              : fieldBase.borderColor,
          }}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel="Time input HH:MM"
        />
        {!!errors?.time && (
          <Text
            style={{ color: COLORS.danger, marginTop: 8, fontWeight: "900" }}
          >
            {errors.time}
          </Text>
        )}
      </View>
    </View>
  );
}
