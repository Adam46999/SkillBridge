import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  total: number;
  upcoming: number;
  pending: number; // requested
  completed: number;
  nextSessionAtIso?: string | null; // optional
};

function formatWhen(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  // مثال: Jan 01, 15:59
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.pillValue} numberOfLines={1}>
        {String(value)}
      </Text>
    </View>
  );
}

export default function SessionsSummaryBar({
  total,
  upcoming,
  pending,
  completed,
  nextSessionAtIso,
}: Props) {
  const next = useMemo(() => formatWhen(nextSessionAtIso), [nextSessionAtIso]);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.topRow}>
        <Text style={styles.title}>Overview</Text>
        {next ? (
          <View
            style={styles.nextWrap}
            accessibilityLabel={`Next session ${next}`}
          >
            <Text style={styles.nextLabel}>Next</Text>
            <Text style={styles.nextValue}>{next}</Text>
          </View>
        ) : (
          <Text style={styles.nextMuted}>No upcoming scheduled</Text>
        )}
      </View>

      <View style={styles.row}>
        <StatPill label="Total" value={total} />
        <StatPill label="Upcoming" value={upcoming} />
        <StatPill label="Pending" value={pending} />
        <StatPill label="Done" value={completed} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#0B1120",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  title: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 14,
  },

  nextWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#020617",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  nextLabel: {
    color: "#94A3B8",
    fontWeight: "900",
    fontSize: 11,
  },

  nextValue: {
    color: "#F97316",
    fontWeight: "900",
    fontSize: 11,
  },

  nextMuted: {
    color: "#64748B",
    fontWeight: "800",
    fontSize: 12,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  pill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#020617",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    minHeight: 58,
  },

  pillLabel: {
    color: "#94A3B8",
    fontWeight: "900",
    fontSize: 11,
  },

  pillValue: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 16,
  },
});
