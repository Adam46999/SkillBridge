// app/manage-skills-to-teach/ManageSkillsToTeachScreen.tsx
import { useRouter, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ✅ reuse learn components
import CategorySelector from "../manage-skills-to-learn/CategorySelector";
import { SubCategorySelector } from "../manage-skills-to-learn/SubCategorySelector";
import SuggestedSkillsGrid from "../manage-skills-to-learn/SuggestedSkillsGrid";
import { SkillSubCategory } from "../manage-skills-to-learn/skillData";

import AddSkillToTeachForm from "./AddSkillToTeachForm";
import { SkillsToTeachList } from "./SkillsToTeachList";
import { Level, SkillTeach, TEACH_LEVELS } from "./types";
import { useManageSkillsToTeach } from "./useManageSkillsToTeach";

const GLOBAL_POPULAR_SKILLS: string[] = [
  "Math tutoring",
  "English conversation",
  "React",
  "Node.js",
  "UI/UX basics",
  "Public speaking",
];

type FilterMode = "all" | "favorites" | "recent";
type ToastType = "success" | "error" | "info";
type ToastState = { visible: boolean; message: string; type: ToastType };
type SheetMode = "quickAdd" | "suggestedAdd" | "addAllSuggested" | "editLevel";

export default function ManageSkillsToTeachScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  React.useEffect(() => {
    try {
      (navigation as any)?.setOptions?.({ headerShown: false });
    } catch {}
  }, [navigation]);

  const {
    skills,
    filteredSkills,
    favoriteSkills,
    loadingInitial,
    saving,
    error,
    searchQuery,
    lastRemoved,
    hasPendingSync,

    selectedCategoryId,
    selectedSubCategoryId,
    selectedCategory,
    subCategories,
    suggestedSkillsByCategory,
    recommendedSkills,
    suggestionPoolForInput,

    setSearchQuery,
    setSelectedCategoryId,
    setSelectedSubCategoryId,

    addSkill,
    addSkillSmart,
    updateSkillLevel,
    trySyncPending,

    removeSkill,
    undoRemove,
    clearAllSkills,
    toggleFavorite,
    clearError,
  } = useManageSkillsToTeach();

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("quickAdd");
  const [sheetSkillName, setSheetSkillName] = useState("");
  const [sheetSelectedLevel, setSheetSelectedLevel] =
    useState<Level>("Intermediate");

  const [duplicateExisting, setDuplicateExisting] = useState<SkillTeach | null>(
    null
  );

  const currentSubCategory: SkillSubCategory | undefined = useMemo(
    () => subCategories.find((s) => s.id === selectedSubCategoryId),
    [subCategories, selectedSubCategoryId]
  );

  const breadcrumbLabel = useMemo(() => {
    if (!selectedCategory && !currentSubCategory) {
      return "Browse all skills or pick a category to get focused suggestions.";
    }
    if (selectedCategory && !currentSubCategory) {
      return `Category: ${selectedCategory.name}`;
    }
    if (selectedCategory && currentSubCategory) {
      return `${selectedCategory.name} → ${currentSubCategory.name}`;
    }
    return "";
  }, [selectedCategory, currentSubCategory]);

  const dynamicPlaceholder = useMemo(() => {
    const name = selectedCategory?.name?.toLowerCase() || "";
    if (name.includes("program"))
      return "Search or add: React, Node.js, Data structures...";
    if (name.includes("lang"))
      return "Search or add: English speaking, Hebrew, Arabic...";
    if (name.includes("design"))
      return "Search or add: UI design, Figma, Logo design...";
    if (name.includes("business") || name.includes("product"))
      return "Search or add: Project management, Marketing...";
    return "Search or add: Math tutoring, Guitar, Public speaking...";
  }, [selectedCategory]);

  const visibleSkills = useMemo(() => {
    let base: SkillTeach[] = filteredSkills;

    if (filterMode === "favorites") {
      base = base.filter((s) =>
        favoriteSkills.some((f) => f.toLowerCase() === s.name.toLowerCase())
      );
    } else if (filterMode === "recent") {
      const recent = skills.slice(-6);
      base = recent.filter((s) =>
        filteredSkills.some((fs) => fs.name === s.name)
      );
    }

    return base;
  }, [filteredSkills, favoriteSkills, filterMode, skills]);

  const stats = useMemo(() => {
    const total = skills.length;
    const fav = favoriteSkills.length;

    const levelCounts: Record<string, number> = {};
    for (const s of skills)
      levelCounts[s.level] = (levelCounts[s.level] ?? 0) + 1;

    let topLevel: string | null = null;
    let topCount = 0;
    for (const k of Object.keys(levelCounts)) {
      const c = levelCounts[k];
      if (c > topCount) {
        topCount = c;
        topLevel = k;
      }
    }
    return { total, fav, topLevel };
  }, [skills, favoriteSkills]);

  const showToast = (message: string, type: ToastType = "info") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, type });
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2400);
  };

  useEffect(() => {
    if (!lastAdded) return;
    showToast(`Added ${lastAdded}`, "success");
    const id = setTimeout(() => setLastAdded(null), 2500);
    return () => clearTimeout(id);
  }, [lastAdded]);

  useEffect(() => {
    trySyncPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddSkillBase = async (name: string, level?: Level) => {
    const safe: Level = level ?? "Not specified";
    const ok = await addSkill(name, safe);
    if (!ok) return;
    setLastAdded(`${name} (${safe})`);
    setFilterMode("all");
    setSearchQuery("");
  };

  const handleAddSkillAndFavorite = async (name: string, level?: Level) => {
    const safe: Level = level ?? "Not specified";
    const ok = await addSkill(name, safe);
    if (!ok) return;
    await toggleFavorite(name);
    setLastAdded(`${name} (${safe}) ★`);
    setFilterMode("all");
    setSearchQuery("");
  };

  const handleClearAllWithConfirm = () => {
    if (!skills.length) return;

    Alert.alert("Remove all skills?", "This will clear your teaching list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: () => clearAllSkills(),
      },
    ]);
  };

  const handleSelectCategory = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedSubCategoryId(null);
    setFilterMode("all");
    setSearchQuery("");
  };

  const handleSelectSubCategory = (id: string | null) => {
    setSelectedSubCategoryId(id);
    setFilterMode("all");
    setSearchQuery("");
  };

  const openQuickAddSheet = () => {
    setDuplicateExisting(null);
    setSheetMode("quickAdd");
    setSheetSkillName("");
    setSheetSelectedLevel("Intermediate");
    setSheetOpen(true);
  };

  const openSuggestedAddSheet = (skillName: string) => {
    setDuplicateExisting(null);
    setSheetMode("suggestedAdd");
    setSheetSkillName(skillName);
    setSheetSelectedLevel("Intermediate");
    setSheetOpen(true);
  };

  const openAddAllSheet = () => {
    setDuplicateExisting(null);
    setSheetMode("addAllSuggested");
    setSheetSkillName("");
    setSheetSelectedLevel("Intermediate");
    setSheetOpen(true);
  };

  const openEditLevelSheet = (skill: SkillTeach) => {
    setDuplicateExisting(null);
    setSheetMode("editLevel");
    setSheetSkillName(skill.name);
    setSheetSelectedLevel(skill.level);
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  const confirmSheetAction = async () => {
    if (sheetMode === "quickAdd") {
      const name = sheetSkillName.trim();
      if (!name) {
        showToast("Type a skill name first.", "error");
        return;
      }

      const res = await addSkillSmart(name, sheetSelectedLevel);
      if (res.ok) {
        setLastAdded(`${res.skill.name} (${res.skill.level})`);
        setFilterMode("all");
        setSearchQuery("");
        closeSheet();
        return;
      }

      if (!res.ok && res.existed) {
        setDuplicateExisting(res.existing);
        showToast("Skill already exists — edit its level?", "info");
        setSheetMode("editLevel");
        setSheetSkillName(res.existing.name);
        setSheetSelectedLevel(res.existing.level);
        return;
      }

      showToast(res.error || "Could not add skill.", "error");
      return;
    }

    if (sheetMode === "suggestedAdd") {
      const res = await addSkillSmart(sheetSkillName, sheetSelectedLevel);
      if (res.ok) {
        setLastAdded(`${res.skill.name} (${res.skill.level})`);
        setFilterMode("all");
        setSearchQuery("");
        closeSheet();
        return;
      }
      if (!res.ok && res.existed) {
        setDuplicateExisting(res.existing);
        showToast("Already in your list — edit level?", "info");
        setSheetMode("editLevel");
        setSheetSkillName(res.existing.name);
        setSheetSelectedLevel(res.existing.level);
        return;
      }
      showToast(res.error || "Could not add skill.", "error");
      return;
    }

    if (sheetMode === "addAllSuggested") {
      if (!suggestedSkillsByCategory.length) return;
      for (const skillName of suggestedSkillsByCategory) {
        await addSkill(skillName, sheetSelectedLevel);
      }
      showToast(
        `Added ${suggestedSkillsByCategory.length} skills (${sheetSelectedLevel})`,
        "success"
      );
      setFilterMode("all");
      setSearchQuery("");
      closeSheet();
      return;
    }

    if (sheetMode === "editLevel") {
      const ok = await updateSkillLevel(sheetSkillName, sheetSelectedLevel);
      if (ok) {
        showToast(`Updated level for ${sheetSkillName}`, "success");
        closeSheet();
      }
      return;
    }
  };

  if (loadingInitial) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your skills...</Text>
      </View>
    );
  }

  const showRecommended = !selectedCategoryId;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000000" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {toast.visible && (
        <View
          style={[styles.toast, toast.type === "error" && styles.toastError]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Skills you can teach</Text>
        <Text style={styles.subtitle}>
          Add what you can teach with the right level for better matching.
        </Text>

        {hasPendingSync && (
          <View style={styles.pendingSyncBar}>
            <Text style={styles.pendingSyncText}>
              ⏳ Saved locally — syncing when online
            </Text>
          </View>
        )}

        <View style={styles.globalSearchWrap}>
          <Text style={styles.globalSearchLabel}>🔎 Search</Text>
          <TextInput
            style={styles.globalSearchInput}
            placeholder={dynamicPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.globalSearchHint}>
            Search filters your teaching list.
          </Text>
        </View>

        {error && (
          <TouchableOpacity
            style={styles.errorBox}
            onPress={clearError}
            activeOpacity={0.85}
          >
            <Text style={styles.errorTitle}>Oops…</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>Tap to dismiss</Text>
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🧭 Category & sub-category</Text>
          <Text style={styles.sectionDescription}>
            Pick a category to get focused suggestions.
          </Text>

          <View style={styles.breadcrumbBar}>
            <Text style={styles.breadcrumbLabel}>You’re exploring</Text>
            <Text style={styles.breadcrumbText}>{breadcrumbLabel}</Text>
          </View>

          <CategorySelector
            selectedCategoryId={selectedCategoryId}
            onSelect={handleSelectCategory}
          />

          <SubCategorySelector
            subCategories={subCategories}
            selectedSubCategoryId={selectedSubCategoryId}
            onSelect={handleSelectSubCategory}
          />
        </View>

        <Text style={styles.mainSectionTitle}>🔍 Discover skills to add</Text>

        <SuggestedSkillsGrid
          title={
            selectedCategory
              ? `Popular in ${selectedCategory.name}`
              : "Suggested skills"
          }
          description="Tap a skill to choose its level and add it."
          skills={suggestedSkillsByCategory}
          onAdd={(name) => openSuggestedAddSheet(name)}
          onAddAll={
            suggestedSkillsByCategory.length ? openAddAllSheet : undefined
          }
          existingSkills={skills.map((s) => s.name)}
          favoriteSkills={favoriteSkills}
          disableAddAll={saving || !suggestedSkillsByCategory.length}
        />

        {showRecommended && (
          <SuggestedSkillsGrid
            title="Recommended skills for most people"
            description="Useful across many careers."
            skills={recommendedSkills}
            onAdd={(name) => openSuggestedAddSheet(name)}
            existingSkills={skills.map((s) => s.name)}
            favoriteSkills={favoriteSkills}
          />
        )}

        {showRecommended && (
          <SuggestedSkillsGrid
            title="Popular among SkillSwap mentors"
            description="Skills many mentors are currently teaching."
            skills={GLOBAL_POPULAR_SKILLS}
            onAdd={(name) => openSuggestedAddSheet(name)}
            existingSkills={skills.map((s) => s.name)}
            favoriteSkills={favoriteSkills}
          />
        )}

        <AddSkillToTeachForm
          onAdd={handleAddSkillBase}
          onAddFavorite={handleAddSkillAndFavorite}
          isSaving={saving}
          suggestionPool={suggestionPoolForInput}
          placeholderHint={dynamicPlaceholder}
        />

        <Text style={styles.mainSectionTitle}>📌 Your teaching list</Text>

        <View style={styles.statsCard}>
          <Text style={styles.statsText}>
            {stats.total} skills • {stats.fav} favorites
            {stats.topLevel ? ` • Top level: ${stats.topLevel}` : ""}
          </Text>
          <Text style={styles.statsHint}>Tap a skill to edit its level.</Text>
        </View>

        <SkillsToTeachList
          skills={visibleSkills}
          totalCount={skills.length}
          searchQuery={searchQuery}
          onChangeSearchQuery={setSearchQuery}
          onRemove={removeSkill}
          favoriteSkills={favoriteSkills}
          onToggleFavorite={toggleFavorite}
          onClearAll={handleClearAllWithConfirm}
          filterMode={filterMode}
          onChangeFilter={setFilterMode}
          onEditLevel={openEditLevelSheet}
        />

        {lastRemoved && (
          <View style={styles.undoBar}>
            <Text style={styles.undoText}>
              Removed {lastRemoved.skill.name}
            </Text>
            <TouchableOpacity onPress={undoRemove} activeOpacity={0.85}>
              <Text style={styles.undoButtonText}>Undo</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, saving && { opacity: 0.6 }]}
        onPress={openQuickAddSheet}
        activeOpacity={0.85}
        disabled={saving}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>
            {sheetMode === "quickAdd" && "Add a skill"}
            {sheetMode === "suggestedAdd" && `Add "${sheetSkillName}"`}
            {sheetMode === "addAllSuggested" && "Add all suggested skills"}
            {sheetMode === "editLevel" && `Edit level: "${sheetSkillName}"`}
          </Text>

          {duplicateExisting && (
            <View style={styles.duplicateCard}>
              <Text style={styles.duplicateTitle}>Already in your list</Text>
              <Text style={styles.duplicateText}>
                Current: {duplicateExisting.name} · {duplicateExisting.level}
              </Text>
              <Text style={styles.duplicateHint}>
                Pick a new level below and press “Save”.
              </Text>
            </View>
          )}

          {sheetMode === "quickAdd" && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.sheetLabel}>Skill name</Text>
              <TextInput
                style={styles.sheetInput}
                placeholder="e.g. Math tutoring"
                placeholderTextColor="#9ca3af"
                value={sheetSkillName}
                onChangeText={(t) => {
                  setDuplicateExisting(null);
                  setSheetSkillName(t);
                }}
                autoCapitalize="sentences"
              />
            </View>
          )}

          <View style={{ marginTop: 14 }}>
            <Text style={styles.sheetLabel}>Choose level</Text>
            <View style={styles.levelRow}>
              {TEACH_LEVELS.slice(0, 4).map((lvl) => {
                const active = sheetSelectedLevel === lvl;
                return (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.levelPill, active && styles.levelPillActive]}
                    onPress={() => setSheetSelectedLevel(lvl)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.levelPillText,
                        active && styles.levelPillTextActive,
                      ]}
                    >
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.sheetButtonsRow}>
            <TouchableOpacity
              style={[styles.sheetBtn, styles.sheetBtnSecondary]}
              onPress={closeSheet}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetBtn, styles.sheetBtnPrimary]}
              onPress={confirmSheetAction}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.sheetBtnPrimaryText}>
                {saving
                  ? "Saving..."
                  : sheetMode === "editLevel"
                  ? "Save"
                  : "Add"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetHint}>
            Tip: Tap a skill in the list to edit level.
          </Text>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 8, fontSize: 14, color: "#94A3B8" },
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, backgroundColor: "#000000" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  backText: { fontSize: 14, color: "#60A5FA" },
  title: { fontSize: 24, fontWeight: "800", color: "#60A5FA", marginTop: 8 },
  subtitle: { fontSize: 14, color: "#CBD5E1", marginTop: 4 },

  pendingSyncBar: {
    marginTop: 10,
    backgroundColor: "#134E4A",
    borderWidth: 1,
    borderColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  pendingSyncText: { fontSize: 12, color: "#86EFAC", fontWeight: "800" },

  globalSearchWrap: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  globalSearchLabel: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
  globalSearchInput: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: "#E5E7EB",
    backgroundColor: "#0B1120",
  },
  globalSearchHint: { marginTop: 6, fontSize: 11, color: "#94A3B8" },

  errorBox: {
    backgroundColor: "#450A0A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FCA5A5",
    marginBottom: 2,
  },
  errorText: { fontSize: 13, color: "#FCA5A5" },
  errorHint: { fontSize: 11, color: "#F87171", marginTop: 4 },

  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#93C5FD",
    marginBottom: 4,
  },
  sectionDescription: { fontSize: 13, color: "#CBD5E1", marginBottom: 8 },

  breadcrumbBar: {
    borderRadius: 10,
    backgroundColor: "#0B1120",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  breadcrumbLabel: { fontSize: 11, color: "#CBD5E1", marginBottom: 2 },
  breadcrumbText: { fontSize: 12, color: "#F1F5F9" },

  mainSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#93C5FD",
    marginTop: 12,
    marginBottom: 6,
  },

  statsCard: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 8,
  },
  statsText: { fontSize: 13, color: "#F1F5F9", fontWeight: "900" },
  statsHint: { marginTop: 4, fontSize: 11, color: "#CBD5E1" },

  undoBar: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#334155",
  },
  undoText: { fontSize: 13, color: "#E5E7EB" },
  undoButtonText: { fontSize: 13, fontWeight: "900", color: "#60A5FA" },

  toast: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastError: { backgroundColor: "#991b1b" },
  toastText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabText: { color: "#ffffff", fontSize: 26, fontWeight: "900" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0B1120",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#334155",
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#93C5FD" },

  duplicateCard: {
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  duplicateTitle: { fontSize: 13, fontWeight: "900", color: "#93C5FD" },
  duplicateText: { marginTop: 4, fontSize: 12, color: "#F1F5F9" },
  duplicateHint: { marginTop: 4, fontSize: 11, color: "#CBD5E1" },

  sheetLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
  },
  sheetInput: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: "#E5E7EB",
    backgroundColor: "#020617",
  },

  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0B1120",
  },
  levelPillActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  levelPillText: { fontSize: 12, color: "#E5E7EB", fontWeight: "900" },
  levelPillTextActive: { color: "#ffffff" },

  sheetButtonsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  sheetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnSecondary: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  sheetBtnSecondaryText: { color: "#E5E7EB", fontWeight: "900", fontSize: 13 },
  sheetBtnPrimary: { backgroundColor: "#2563eb" },
  sheetBtnPrimaryText: { color: "#ffffff", fontWeight: "900", fontSize: 13 },

  sheetHint: { marginTop: 10, fontSize: 11, color: "#94A3B8" },
});
