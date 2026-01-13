import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ProfileCompletionStatus } from "../../../../lib/profileCompletion";

type Props = {
  profileStatus: ProfileCompletionStatus;
  setupCompleted: number;
  setupTotal: number;
  hasInbox: boolean;

  onGoProfileNext: () => void;
  onStartSetup: () => void;
  onFindMentor: () => void;
  onOpenChats: () => void;
};

export default function NextBestActionCard({
  profileStatus,
  setupCompleted,
  setupTotal,
  hasInbox,
  onGoProfileNext,
  onStartSetup,
  onFindMentor,
  onOpenChats,
}: Props) {
  const model = useMemo(() => {
    // أولوية 1: بروفايل ناقص
    if (!profileStatus?.isComplete) {
      return {
        title: "Complete your profile",
        body: "Finish the remaining steps to unlock better mentor matches.",
        primary: "Continue",
        onPrimary: onGoProfileNext,
        secondary: null as null | { label: string; onPress: () => void },
      };
    }

    // أولوية 2: setup ناقص
    if (setupCompleted < setupTotal) {
      return {
        title: "Finish setup",
        body: `You're ${setupCompleted}/${setupTotal}. Add the missing parts to start faster.`,
        primary: "Start setup",
        onPrimary: onStartSetup,
        secondary: null,
      };
    }

    // أولوية 3: ما في inbox
    if (!hasInbox) {
      return {
        title: "Find your first mentor",
        body: "Browse mentors and start a conversation in minutes.",
        primary: "Find mentors",
        onPrimary: onFindMentor,
        secondary: null,
      };
    }

    // أولوية 4: في inbox
    return {
      title: "Continue where you left off",
      body: "Open your inbox and reply quickly.",
      primary: "Open chats",
      onPrimary: onOpenChats,
      secondary: { label: "Find mentors", onPress: onFindMentor },
    };
  }, [
    profileStatus,
    setupCompleted,
    setupTotal,
    hasInbox,
    onGoProfileNext,
    onStartSetup,
    onFindMentor,
    onOpenChats,
  ]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{model.title}</Text>
      <Text style={styles.body}>{model.body}</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.primary}
          activeOpacity={0.85}
          onPress={model.onPrimary}
        >
          <Text style={styles.primaryText}>{model.primary}</Text>
        </TouchableOpacity>

        {model.secondary ? (
          <TouchableOpacity
            style={styles.secondary}
            activeOpacity={0.85}
            onPress={model.secondary.onPress}
          >
            <Text style={styles.secondaryText}>{model.secondary.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "#0B1220",
  },
  title: { color: "#E5E7EB", fontSize: 15, fontWeight: "900" },
  body: { color: "#9CA3AF", fontSize: 12, marginTop: 6 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  primary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#10B981",
  },
  primaryText: { color: "#06281C", fontWeight: "900" },

  secondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },
  secondaryText: { color: "#E5E7EB", fontWeight: "900" },
});
