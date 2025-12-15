// app/manage-skills-to-learn/SuggestedSkillsGrid.tsx
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SkillChip } from "./SkillChip";

type Props = {
  title: string;
  description?: string;
  skills: string[];
  onAdd: (name: string) => void;
  onAddAll?: () => void;
  existingSkills: string[]; // names only
  favoriteSkills: string[]; // names only
  disableAddAll?: boolean;
};

export default function SuggestedSkillsGrid({
  title,
  description,
  skills,
  onAdd,
  onAddAll,
  existingSkills,
  favoriteSkills,
  disableAddAll = false,
}: Props) {
  const existingLower = new Set(existingSkills.map((s) => s.toLowerCase()));
  const favLower = new Set(favoriteSkills.map((s) => s.toLowerCase()));

  if (!skills?.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {!!description && <Text style={styles.desc}>{description}</Text>}
        </View>

        {!!onAddAll && (
          <TouchableOpacity
            onPress={disableAddAll ? () => {} : onAddAll}
            activeOpacity={disableAddAll ? 1 : 0.8}
            style={[styles.addAllBtn, disableAddAll && { opacity: 0.5 }]}
            disabled={disableAddAll}
          >
            <Text style={styles.addAllText}>Add all</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.wrap}>
        {skills.map((name) => {
          const added = existingLower.has(name.toLowerCase());
          const isFav = favLower.has(name.toLowerCase());

          // ✅ مهم: SkillChip لازم onPress دايمًا
          const handlePress = added ? () => {} : () => onAdd(name);

          return (
            <SkillChip
              key={name}
              label={name}
              onPress={handlePress}
              compact
              disabled={added}
              added={added}
              showPlusIcon={!added}
              isFavorite={isFav}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  desc: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  addAllBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f9fafb",
  },
  addAllText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
