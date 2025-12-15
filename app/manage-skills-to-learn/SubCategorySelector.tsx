// app/manage-skills-to-learn/SubCategorySelector.tsx
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SkillSubCategory } from "./skillData";

type Props = {
  subCategories: SkillSubCategory[];
  selectedSubCategoryId: string | null;
  onSelect: (id: string | null) => void;
};

export const SubCategorySelector: React.FC<Props> = ({
  subCategories,
  selectedSubCategoryId,
  onSelect,
}) => {
  if (!subCategories.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sub-category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <TouchableOpacity
          style={[
            styles.chip,
            selectedSubCategoryId === null && styles.chipActive,
          ]}
          onPress={() => onSelect(null)}
        >
          <Text
            style={[
              styles.chipText,
              selectedSubCategoryId === null && styles.chipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {subCategories.map((sub) => {
          const isActive = sub.id === selectedSubCategoryId;
          return (
            <TouchableOpacity
              key={sub.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelect(sub.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.chipText, isActive && styles.chipTextActive]}
              >
                {sub.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  chipActive: {
    backgroundColor: "#1d4ed8",
  },
  chipText: {
    fontSize: 13,
    color: "#111827",
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
