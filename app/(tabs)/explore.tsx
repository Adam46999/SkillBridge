import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#e5e7eb",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#9ca3af",
  },
});
