// app/manage-skills-to-learn/SkillChip.tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  compact?: boolean;

  disabled?: boolean;
  added?: boolean;

  showPlusIcon?: boolean;
  isFavorite?: boolean;

  // (24) accessibility extras
  accessibilityHint?: string;
};

export function SkillChip({
  label,
  onPress,
  compact = false,
  disabled = false,
  added = false,
  showPlusIcon = false,
  isFavorite = false,
  accessibilityHint,
}: Props) {
  const showPlus = showPlusIcon && !added;
  const showCheck = added;

  const badgeText = showCheck ? "✓" : showPlus ? "＋" : "";
  const badgeLabel = showCheck ? "Added" : showPlus ? "Add" : "";

  return (
    <TouchableOpacity
      onPress={disabled ? () => {} : onPress}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        disabled && styles.chipDisabled,
        added && styles.chipAdded,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        accessibilityHint ||
        (disabled ? "This item is disabled." : "Tap to select this skill.")
      }
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View style={styles.row}>
        {/* Left badge (＋ / ✓) */}
        {(showPlus || showCheck) && (
          <View
            style={[
              styles.badge,
              showCheck && styles.badgeCheck,
              showPlus && styles.badgePlus,
            ]}
            accessibilityLabel={badgeLabel}
          >
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}

        {/* Favorite star */}
        {isFavorite && (
          <Text style={styles.star} accessibilityLabel="Favorite">
            ★
          </Text>
        )}

        <Text
          style={[styles.label, disabled && styles.labelDisabled]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipDisabled: {
    opacity: 0.62,
  },
  chipAdded: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  badge: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badgeCheck: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  badgePlus: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  badgeText: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "900",
    lineHeight: 14,
  },

  star: {
    fontSize: 14,
    color: "#f59e0b",
    fontWeight: "900",
    marginRight: 2,
  },

  label: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
    maxWidth: 240,
  },
  labelDisabled: {
    color: "#6b7280",
  },
});
