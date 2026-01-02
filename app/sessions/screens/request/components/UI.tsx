// app/sessions/screens/request/components/UI.tsx
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { COLORS, shadowCard } from "../styles";

/**
 * UI primitives – refined for clarity, speed, and consistency
 * No logic changes, visuals only.
 */

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: COLORS.text,
        fontWeight: "900",
        fontSize: 18,
        textAlign: "center",
      }}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: COLORS.muted,
        fontWeight: "900",
        fontSize: 12,
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: COLORS.hint,
        fontWeight: "800",
        fontSize: 12,
        marginTop: 6,
      }}
    >
      {children}
    </Text>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        ...shadowCard,
        gap: 14,
      }}
    >
      {children}
    </View>
  );
}

export function PrimaryBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled || !!loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          borderRadius: 999,
          paddingVertical: 14,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.orange,
          borderWidth: 1,
          borderColor: COLORS.orangeBorder,
          opacity: disabled || loading ? 0.55 : 1,
          minHeight: 48,
        },
        pressed ? { opacity: 0.92 } : null,
      ]}
    >
      {loading ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ color: "#111827", fontWeight: "900" }}>Working…</Text>
        </View>
      ) : (
        <Text style={{ color: "#111827", fontWeight: "900" }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostBtn({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bg,
          minHeight: 44,
          justifyContent: "center",
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
        {label}
      </Text>
    </Pressable>
  );
}
