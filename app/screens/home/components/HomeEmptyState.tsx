import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  onStartSetup: () => void;
};

export default function HomeEmptyState({ onStartSetup }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Let’s set you up</Text>
      <Text style={styles.body}>
        Add learning goals, availability, and what you can teach — then you’re
        ready to match.
      </Text>

      <View style={styles.steps}>
        <Text style={styles.step}>1) Add a learning goal</Text>
        <Text style={styles.step}>2) Set weekly availability</Text>
        <Text style={styles.step}>3) Add a skill to teach</Text>
      </View>

      <TouchableOpacity
        style={styles.primary}
        activeOpacity={0.85}
        onPress={onStartSetup}
      >
        <Text style={styles.primaryText}>Start setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "#0B1220",
  },
  title: { color: "#E5E7EB", fontSize: 16, fontWeight: "900" },
  body: { color: "#9CA3AF", fontSize: 12, marginTop: 8 },
  steps: { marginTop: 12, gap: 6 },
  step: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },

  primary: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#10B981",
  },
  primaryText: { color: "#06281C", fontWeight: "900" },
});
