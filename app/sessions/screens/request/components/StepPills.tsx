// app/sessions/screens/request/components/StepPills.tsx
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import type { Step } from "../(hooks)/useRequestSessionForm";
import { COLORS } from "../styles";

export default function StepPills({ step }: { step: Step }) {
  const items = useMemo(
    () =>
      [
        { n: 1 as const, label: "Topic" },
        { n: 2 as const, label: "Time" },
        { n: 3 as const, label: "Note" },
      ] as const,
    []
  );

  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {items.map((it) => {
        const active = it.n === step;
        const done = it.n < step;

        return (
          <View
            key={it.n}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? COLORS.orange : COLORS.border,
              backgroundColor: active ? COLORS.card : COLORS.bg,
              opacity: done ? 0.92 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
            accessibilityRole="text"
            accessibilityLabel={`Step ${it.n}: ${it.label}${
              active ? " (current)" : done ? " (done)" : ""
            }`}
          >
            {/* number / check */}
            <Text
              style={{
                color: active ? "#FED7AA" : done ? "#86EFAC" : COLORS.muted,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {done ? "✓" : it.n}
            </Text>

            {/* label */}
            <Text
              style={{
                color: active ? "#FED7AA" : COLORS.muted,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {it.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
