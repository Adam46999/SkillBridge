import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Variant = "noSessions" | "noResults" | "error";

type Props = {
  variant: Variant;
  title?: string;
  body?: string;
  primaryText?: string;
  onPrimary?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
};

export default function SessionsEmptyState({
  variant,
  title,
  body,
  primaryText,
  onPrimary,
  secondaryText,
  onSecondary,
}: Props) {
  const defaults = getDefaults(variant);

  const t = title || defaults.title;
  const b = body || defaults.body;

  const showPrimary = !!primaryText && !!onPrimary;
  const showSecondary = !!secondaryText && !!onSecondary;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.icon} accessibilityLabel="Empty state icon">
        {defaults.icon}
      </Text>

      <Text style={styles.title}>{t}</Text>
      <Text style={styles.body}>{b}</Text>

      {(showPrimary || showSecondary) && (
        <View style={styles.btnRow}>
          {showPrimary && (
            <Pressable
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel={primaryText}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed ? { opacity: 0.92 } : null,
              ]}
              hitSlop={10}
            >
              <Text style={styles.primaryText}>{primaryText}</Text>
            </Pressable>
          )}

          {showSecondary && (
            <Pressable
              onPress={onSecondary}
              accessibilityRole="button"
              accessibilityLabel={secondaryText}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed ? { opacity: 0.92 } : null,
              ]}
              hitSlop={10}
            >
              <Text style={styles.secondaryText}>{secondaryText}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function getDefaults(v: Variant) {
  if (v === "noResults") {
    return {
      icon: "🔎",
      title: "No results",
      body: "Try changing filters or search keywords.",
    };
  }

  if (v === "error") {
    return {
      icon: "⚠️",
      title: "Something went wrong",
      body: "Couldn’t load sessions. Please try again.",
    };
  }

  return {
    icon: "🗓️",
    title: "No sessions yet",
    body: "When you request a session, it will appear here with full details.",
  };
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#0B1120",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },

  icon: {
    fontSize: 28,
  },

  title: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },

  body: {
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  primaryBtn: {
    backgroundColor: "#F97316",
    borderColor: "#FB923C",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  primaryText: {
    color: "#111827",
    fontWeight: "900",
  },

  secondaryBtn: {
    backgroundColor: "#020617",
    borderColor: "#1E293B",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  secondaryText: {
    color: "#E5E7EB",
    fontWeight: "900",
  },
});
