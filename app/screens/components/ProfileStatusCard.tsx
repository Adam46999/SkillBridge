// app/screens/components/ProfileStatusCard.tsx
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ProfileCompletionStatus } from "../../../lib/profileCompletion";

type Props = {
  status: ProfileCompletionStatus;
};

function pickNextSection(status: ProfileCompletionStatus) {
  // أول قسم ناقص
  return status.sections.find((s) => !s.done) || status.sections[0];
}

export default function ProfileStatusCard({ status }: Props) {
  const router = useRouter();

  const next = useMemo(() => pickNextSection(status), [status]);

  const progressText = status.isComplete
    ? "Complete"
    : `${status.doneCount}/${status.totalCount} done`;

  const subtitle = status.isComplete
    ? "Your profile is ready. You’ll get better matches."
    : "Finish these steps to unlock better mentor matches.";

  const onPrimary = () => {
    if (!next?.href) return;
    router.push(next.href as any);
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Profile completion</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.percentPill}>
          <Text style={styles.percentText}>{status.percent}%</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressBg}>
          <View
            style={[styles.progressFill, { width: `${status.percent}%` }]}
          />
        </View>
        <Text style={styles.progressMeta}>{progressText}</Text>
      </View>

      {!status.isComplete && (
        <View style={styles.nextBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextTitle}>Next step</Text>
            <Text style={styles.nextHint}>{next.hint}</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onPrimary}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{next.ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.stepsWrap}>
        {status.sections.map((s) => (
          <View
            key={s.key}
            style={[
              styles.stepChip,
              s.done ? styles.stepChipDone : styles.stepChipTodo,
            ]}
          >
            <Text
              style={[
                styles.stepText,
                s.done ? styles.stepTextDone : styles.stepTextTodo,
              ]}
            >
              {s.done ? "✅" : "⬜"} {s.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 16,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { color: "#F9FAFB", fontSize: 15, fontWeight: "700" },
  subtitle: { color: "#64748B", fontSize: 12, marginTop: 4 },

  percentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#334155",
  },
  percentText: { color: "#F97316", fontSize: 12, fontWeight: "800" },

  progressRow: { marginTop: 10 },
  progressBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#111827",
  },
  progressFill: { height: "100%", backgroundColor: "#F97316" },
  progressMeta: { color: "#94A3B8", fontSize: 11, marginTop: 6 },

  nextBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#0B1120",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextTitle: { color: "#E5E7EB", fontSize: 12, fontWeight: "800" },
  nextHint: { color: "#94A3B8", fontSize: 11, marginTop: 4 },

  primaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F97316",
  },
  primaryBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },

  stepsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  stepChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  stepChipDone: { backgroundColor: "#052e16", borderColor: "#14532d" },
  stepChipTodo: { backgroundColor: "#0F172A", borderColor: "#1E293B" },

  stepText: { fontSize: 11, fontWeight: "700" },
  stepTextDone: { color: "#BBF7D0" },
  stepTextTodo: { color: "#E5E7EB" },
});
