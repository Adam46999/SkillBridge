// app/sessions/screens/request/components/StickyFooter.tsx
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { COLORS } from "../styles";

/**
 * StickyFooter
 * UI/UX improvements only:
 * - Clear primary action
 * - Stable button size (no layout jump on loading)
 * - Visual priority to Next / Send
 * - Back is secondary and calm
 */
export default function StickyFooter({
  showBack,
  backLabel,
  nextLabel,
  disableNext,
  loading,
  onBack,
  onNext,
}: {
  showBack: boolean;
  backLabel: string;
  nextLabel: string;
  disableNext?: boolean;
  loading?: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Back (secondary) */}
      {showBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          style={({ pressed }) => [
            {
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.bg,
            },
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 13,
            }}
          >
            {backLabel}
          </Text>
        </Pressable>
      ) : (
        <View />
      )}

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Primary action */}
      <Pressable
        onPress={onNext}
        disabled={!!disableNext || !!loading}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        style={({ pressed }) => [
          {
            minWidth: 180,
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.orange,
            borderWidth: 1,
            borderColor: COLORS.orangeBorder,
            opacity: disableNext || loading ? 0.55 : 1,
          },
          pressed ? { opacity: 0.92 } : null,
        ]}
      >
        {loading ? (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator />
            <Text
              style={{
                color: "#111827",
                fontWeight: "900",
                fontSize: 14,
              }}
            >
              Sending…
            </Text>
          </View>
        ) : (
          <Text
            style={{
              color: "#111827",
              fontWeight: "900",
              fontSize: 14,
            }}
          >
            {nextLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
