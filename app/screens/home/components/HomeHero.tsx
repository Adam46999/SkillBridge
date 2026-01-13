import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  fullName?: string;
  initials: string;
  level: number;
  progress: number; // 0..100
  streak: number;
  nextLine: string;
  onPrimary: () => void; // Find mentor
  onSecondary: () => void; // Sessions
};

export default function HomeHero({
  fullName,
  initials,
  level,
  progress,
  streak,
  nextLine,
  onPrimary,
  onSecondary,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{fullName || "SkillSwap user"}</Text>
          <Text style={styles.next}>{nextLine}</Text>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onPrimary}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>
                Start learning → Find a mentor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onSecondary}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryText}>My sessions</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.levelBox}>
          <Text style={styles.levelLabel}>Level</Text>
          <Text style={styles.levelVal}>{level}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>XP progress</Text>
            <Text style={styles.progressVal}>
              {Math.min(progress, 100)}/100
            </Text>
          </View>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(progress, 100)}%` },
              ]}
            />
          </View>
        </View>

        {streak > 0 ? (
          <View style={styles.streak}>
            <Text style={{ marginRight: 4 }}>🔥</Text>
            <Text style={styles.streakText}>{streak}-day</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 12,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  greeting: { color: "#9CA3AF", fontSize: 13, fontWeight: "700" },
  name: { color: "#F9FAFB", fontSize: 22, fontWeight: "900", marginTop: 4 },
  next: { color: "#94A3B8", fontSize: 12, marginTop: 8, lineHeight: 18 },

  ctaRow: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  primaryBtn: {
    flexGrow: 1,
    backgroundColor: "#F97316",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  primaryText: { color: "#0B1120", fontWeight: "900", fontSize: 13 },
  secondaryBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0B1120",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  secondaryText: { color: "#E5E7EB", fontWeight: "900", fontSize: 13 },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#F97316", fontSize: 18, fontWeight: "900" },

  bottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  levelBox: { width: 66 },
  levelLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "800" },
  levelVal: { color: "#E5E7EB", fontSize: 20, fontWeight: "900", marginTop: 2 },

  progressHead: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "800" },
  progressVal: { color: "#CBD5F5", fontSize: 11, fontWeight: "800" },
  progressBg: {
    marginTop: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#111827",
  },
  progressFill: { height: "100%", backgroundColor: "#F97316" },

  streak: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#F97316",
    flexDirection: "row",
    alignItems: "center",
  },
  streakText: { color: "#FED7AA", fontSize: 11, fontWeight: "900" },
});
