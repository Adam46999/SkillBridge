// app/manage-skills-to-learn/SkillsToLearnList.tsx
import React from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SkillChip } from "./SkillChip";
import { SkillToLearn } from "./types";

type FilterMode = "all" | "favorites" | "recent";

type Props = {
  skills: SkillToLearn[];
  totalCount: number;
  searchQuery: string;
  onChangeSearchQuery: (text: string) => void;

  // ✅ FIX: now matches the hook perfectly
  onRemove: (skill: SkillToLearn) => Promise<void> | void;

  favoriteSkills: string[];
  onToggleFavorite: (skillName: string) => Promise<void> | void;
  onClearAll: () => void;
  filterMode: FilterMode;
  onChangeFilter: (mode: FilterMode) => void;
  onLayoutCard?: (y: number) => void;
  onEditLevel?: (skill: SkillToLearn) => void;
};

export const SkillsToLearnList: React.FC<Props> = ({
  skills,
  totalCount,
  searchQuery,
  onChangeSearchQuery,
  onRemove,
  favoriteSkills,
  onToggleFavorite,
  onClearAll,
  filterMode,
  onChangeFilter,
  onLayoutCard,
  onEditLevel,
}) => {
  const getFilterIcon = (mode: FilterMode) => {
    if (mode === "all") return "✔";
    if (mode === "favorites") return "★";
    return "⏱";
  };

  const renderFilterButton = (mode: FilterMode, label: string) => {
    const active = filterMode === mode;
    const icon = getFilterIcon(mode);
    return (
      <TouchableOpacity
        key={mode}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => onChangeFilter(mode)}
      >
        <Text
          style={[styles.filterChipText, active && styles.filterChipTextActive]}
        >
          {icon} {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    if (onLayoutCard) onLayoutCard(e.nativeEvent.layout.y);
  };

  const isFavorite = (name: string) =>
    favoriteSkills.some((f) => f.toLowerCase() === name.toLowerCase());

  return (
    <View style={styles.card} onLayout={handleLayout}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Your learning list</Text>
        <Text style={styles.countBadge}>{totalCount}</Text>
      </View>

      <View style={styles.filtersRow}>
        {renderFilterButton("all", "All")}
        {renderFilterButton("favorites", "Favorites")}
        {renderFilterButton("recent", "Recent")}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search in your learning skills..."
        value={searchQuery}
        onChangeText={onChangeSearchQuery}
        placeholderTextColor="#9ca3af"
      />

      {skills.length === 0 ? (
        <Text style={styles.emptyText}>
          You don’t have any learning skills in this view yet. Choose a category
          above, tap a suggested skill, or add your own.
        </Text>
      ) : (
        <View style={styles.skillsWrap}>
          {skills.map((skill) => {
            const fav = isFavorite(skill.name);
            return (
              <View
                style={styles.skillRow}
                key={`${skill.name}-${skill.level}`}
              >
                <SkillChip
                  label={`${skill.name} · ${skill.level}`}
                  onPress={() => {}}
                />

                <View style={styles.skillActions}>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite(skill.name)}
                    style={styles.favoriteButton}
                  >
                    <Text style={styles.favoriteText}>{fav ? "★" : "☆"}</Text>
                  </TouchableOpacity>

                  {onEditLevel && (
                    <TouchableOpacity
                      onPress={() => onEditLevel(skill)}
                      style={styles.editButton}
                    >
                      <Text style={styles.editIcon}>✏️</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => onRemove(skill)} // ✅ FIX: remove by object
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeIcon}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {totalCount > 0 && (
        <TouchableOpacity style={styles.clearAllButton} onPress={onClearAll}>
          <Text style={styles.clearAllText}>Clear all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F9FAFB",
    flex: 1,
  },
  countBadge: {
    fontSize: 12,
    color: "#E5E7EB",
    backgroundColor: "#1E293B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0B1120",
  },
  filterChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  filterChipText: {
    fontSize: 12,
    color: "#E5E7EB",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#E5E7EB",
    backgroundColor: "#0B1120",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  skillsWrap: {
    gap: 8,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skillActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
  },
  favoriteButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  favoriteText: {
    fontSize: 16,
    color: "#f59e0b",
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#450A0A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  removeIcon: {
    fontSize: 13,
  },
  clearAllButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0B1120",
  },
  clearAllText: {
    fontSize: 12,
    color: "#E5E7EB",
  },
});
