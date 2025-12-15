// app/manage-skills-to-learn/CategorySelector.tsx
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SKILL_CATEGORIES, SkillCategory } from "./skillData";

export type CategorySelectorProps = {
  selectedCategoryId: string | null;
  onSelect: (id: string) => void;
};

const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {SKILL_CATEGORIES.map((cat: SkillCategory) => {
          const isActive = cat.id === selectedCategoryId;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelect(cat.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.chipEmoji}>{cat.icon}</Text>
              <Text
                style={[styles.chipText, isActive && styles.chipTextActive]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default CategorySelector;

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#1d4ed8",
  },
  chipEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
