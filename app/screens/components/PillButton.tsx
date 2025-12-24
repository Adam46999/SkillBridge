import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

type PillButtonProps = {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function PillButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
}: PillButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.pill, isDisabled && styles.pillDisabled, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={[styles.text, isDisabled && styles.textDisabled]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)", // slate-400-ish
    backgroundColor: "rgba(15, 23, 42, 0.55)", // slate-900-ish
    alignItems: "center",
    justifyContent: "center",
  },
  pillDisabled: {
    opacity: 0.7,
  },
  text: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#e5e7eb",
    letterSpacing: 0.2,
  },
  textDisabled: {
    color: "rgba(229, 231, 235, 0.85)",
  },
});
