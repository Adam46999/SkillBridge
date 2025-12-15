// app/manage-skills-to-teach/SkillsToTeachList.tsx
import React from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SkillChip } from "../manage-skills-to-learn/SkillChip";
import { SkillTeach } from "./types";

type FilterMode = "all" | "favorites" | "recent";

type Props = {
  skills: SkillTeach[];
  totalCount: number;
  searchQuery: string;
  onChangeSearchQuery: (text: string) => void;

  onRemove: (skill: SkillTeach) => Promise<void> | void;

  favoriteSkills: string[];
  onToggleFavorite: (skillName: string) => Promise<void> | void;

  onClearAll: () => void;

  filterMode: FilterMode;
  onChangeFilter: (mode: FilterMode) => void;

  // ✅ optional: for edit level from list (we'll use it)
  onEditLevel?: (skill: SkillTeach) => void;

  onLayoutCard?: (y: number) => void;
};

export const SkillsToTeachList: React.FC<Props> = ({
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
  onEditLevel,
  onLayoutCard,
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
        activeOpacity={0.85}
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
        <Text style={styles.sectionTitle}>Your teaching list</Text>
        <Text style={styles.countBadge}>{totalCount}</Text>
      </View>

      <View style={styles.filtersRow}>
        {renderFilterButton("all", "All")}
        {renderFilterButton("favorites", "Favorites")}
        {renderFilterButton("recent", "Recent")}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search in your teaching skills..."
        value={searchQuery}
        onChangeText={onChangeSearchQuery}
        placeholderTextColor="#9ca3af"
      />

      {skills.length === 0 ? (
        <Text style={styles.emptyText}>
          You don’t have any teaching skills in this view yet. Choose a category
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
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onEditLevel?.(skill)}
                  disabled={!onEditLevel}
                >
                  <SkillChip
                    label={`${skill.name} · ${skill.level}`}
                    onPress={() => onEditLevel?.(skill)}
                    disabled={!onEditLevel}
                  />
                </TouchableOpacity>

                <View style={styles.skillActions}>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite(skill.name)}
                    style={styles.favoriteButton}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.favoriteText}>{fav ? "★" : "☆"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onRemove(skill)}
                    style={styles.removeButton}
                    activeOpacity={0.85}
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
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={onClearAll}
          activeOpacity={0.85}
        >
          <Text style={styles.clearAllText}>Clear all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  countBadge: {
    fontSize: 12,
    color: "#111827",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  filtersRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  filterChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  filterChipText: { fontSize: 12, color: "#374151" },
  filterChipTextActive: { color: "#ffffff", fontWeight: "700" },

  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#f9fafb",
    marginBottom: 10,
  },
  emptyText: { fontSize: 13, color: "#6b7280" },

  skillsWrap: { gap: 8 },
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
  favoriteButton: { paddingHorizontal: 6, paddingVertical: 4 },
  favoriteText: { fontSize: 16, color: "#f59e0b" },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  removeIcon: { fontSize: 13 },

  clearAllButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  clearAllText: { fontSize: 12, color: "#374151", fontWeight: "700" },
});
