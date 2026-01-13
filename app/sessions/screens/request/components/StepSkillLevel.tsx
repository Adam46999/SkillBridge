// app/sessions/screens/request/components/StepSkillLevel.tsx
import React, { useMemo } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { COLORS, fieldBase } from "../styles";
import { Hint, Label } from "./UI";

type Props = {
  skill: string;
  level: string;
  onChangeSkill: (v: string) => void;
  onChangeLevel: (v: string) => void;
};

function Chip({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? COLORS.orange : COLORS.border,
          backgroundColor: active ? COLORS.card : COLORS.bg,
          // ✅ clearer "pressed" feedback
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
        {label}
      </Text>
    </Pressable>
  );
}

export default function StepSkillLevel({
  skill,
  level,
  onChangeSkill,
  onChangeLevel,
}: Props) {
  const levelOptions = useMemo(
    () => ["Beginner", "Intermediate", "Advanced", "Not sure"],
    []
  );

  const skillPresets = useMemo(
    () => ["English", "React", "Math", "Interview prep"],
    []
  );

  return (
    <View style={{ gap: 14 }}>
      {/* Skill */}
      <View>
        <Label>Skill</Label>
        <TextInput
          value={skill}
          onChangeText={onChangeSkill}
          placeholder="e.g. React basics"
          placeholderTextColor={COLORS.hint}
          style={fieldBase}
          autoCapitalize="sentences"
          autoCorrect={false}
          accessibilityLabel="Skill input"
          returnKeyType="next"
        />

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 10,
          }}
        >
          {skillPresets.map((s) => {
            const active = skill.trim().toLowerCase() === s.toLowerCase();
            return (
              <Chip
                key={s}
                label={s}
                active={active}
                onPress={() => onChangeSkill(s)}
                accessibilityLabel={`Select skill ${s}`}
              />
            );
          })}
        </View>

        <Hint>Tap a preset to avoid typing mistakes.</Hint>
      </View>

      {/* Level */}
      <View>
        <Label>Level</Label>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 10,
          }}
        >
          {levelOptions.map((opt) => {
            const active = level.trim().toLowerCase() === opt.toLowerCase();
            return (
              <Chip
                key={opt}
                label={opt}
                active={active}
                onPress={() => onChangeLevel(opt)}
                accessibilityLabel={`Select level ${opt}`}
              />
            );
          })}
        </View>

        {/* keep fallback input, but make it clearly secondary */}
        <TextInput
          value={level}
          onChangeText={onChangeLevel}
          placeholder="Or type a custom level (optional)"
          placeholderTextColor={COLORS.hint}
          style={{
            ...fieldBase,
            marginTop: 12,
            opacity: 0.85,
          }}
          accessibilityLabel="Custom level input"
        />
      </View>
    </View>
  );
}
