// app/manage-skills-to-learn/ManageSkillsToLearnScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
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

import AddSkillToLearnForm from "./AddSkillToLearnForm";
import CategorySelector from "./CategorySelector";
import { SkillSubCategory } from "./skillData";
import { SkillsToLearnList } from "./SkillsToLearnList";
import { SubCategorySelector } from "./SubCategorySelector";
import SuggestedSkillsGrid from "./SuggestedSkillsGrid";
import { LEARN_LEVELS, LearnLevel, SkillToLearn } from "./types";
import { useManageSkillsToLearn } from "./useManageSkillsToLearn";

const GLOBAL_POPULAR_SKILLS: string[] = [
  "Public speaking",
  "Time management",
  "English conversation",
  "Excel / Google Sheets",
  "Problem solving",
  "Presentation design",
];

type FilterMode = "all" | "favorites" | "recent";

// Quick Start (shown once)
const QUICK_START_KEY = "skillsToLearn_quickStartSeen_v1";

// Toast
type ToastType = "success" | "error" | "info";
type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
};

// Bottom Sheet modes
type SheetMode = "quickAdd" | "suggestedAdd" | "addAllSuggested" | "editLevel";

export default function ManageSkillsToLearnScreen() {
  const router = useRouter();

  const {
    skills,
    filteredSkills,
    favoriteSkills,
    loadingInitial,
    saving,
    error,
    searchQuery,
    lastRemoved,

    hasPendingSync, // (22)

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
    addSkillSmart, // (12)
    updateSkillLevel, // (11)
    trySyncPending, // (22)

    removeSkill,
    undoRemove,
    clearAllSkills,
    toggleFavorite,
    clearError,
  } = useManageSkillsToLearn();

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // Quick Start
  const [showQuickStart, setShowQuickStart] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bottom sheet (modal)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("quickAdd");
  const [sheetSkillName, setSheetSkillName] = useState("");
  const [sheetSelectedLevel, setSheetSelectedLevel] =
    useState<LearnLevel>("Intermediate");

  // (12) when duplicate happens, we store the existing skill
  const [duplicateExisting, setDuplicateExisting] =
    useState<SkillToLearn | null>(null);

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

  // Global search placeholder
  const dynamicPlaceholder = useMemo(() => {
    const name = selectedCategory?.name?.toLowerCase() || "";
    if (name.includes("program"))
      return "Search or add: React, Python, Algorithms...";
    if (name.includes("lang"))
      return "Search or add: English speaking, Academic writing...";
    if (name.includes("design"))
      return "Search or add: UI design, Figma, Logo design...";
    if (name.includes("business") || name.includes("product"))
      return "Search or add: Project management, Marketing basics...";
    return "Search or add: React Native, Guitar, Public speaking...";
  }, [selectedCategory]);

  // Visible skills (filters)
  const visibleSkills = useMemo(() => {
    let base: SkillToLearn[] = filteredSkills;

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

  // Step state
  const isStep1Active = !selectedCategoryId;
  const isStep2Active = !!selectedCategoryId && !selectedSubCategoryId;
  const isStep3Active =
    (!!selectedCategoryId && !!selectedSubCategoryId) || skills.length > 0;

  // Progressive disclosure rules (2)
  const showRecommended = !selectedCategoryId;
  const showDiscoverSection = true;
  const showYourListSection = skills.length > 0 || !!selectedCategoryId;

  // Quick Start load (3)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(QUICK_START_KEY);
        if (!mounted) return;
        if (!seen && skills.length === 0) setShowQuickStart(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [skills.length]);

  const dismissQuickStart = async () => {
    setShowQuickStart(false);
    try {
      await AsyncStorage.setItem(QUICK_START_KEY, "1");
    } catch {
      // ignore
    }
  };

  // Toast helper (4)
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

  // Sync pending when screen loads (22)
  useEffect(() => {
    // try once on mount (safe even if no pending)
    trySyncPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Add handlers -----
  const handleAddSkillBase = async (name: string, level?: LearnLevel) => {
    const safe: LearnLevel = level ?? "Not specified";
    const ok = await addSkill(name, safe);
    if (!ok) return;
    setLastAdded(`${name} (${safe})`);
    setFilterMode("all");
    setSearchQuery("");
  };

  const handleAddSkillAndFavorite = async (
    name: string,
    level?: LearnLevel
  ) => {
    const safe: LearnLevel = level ?? "Not specified";
    const ok = await addSkill(name, safe);
    if (!ok) return;
    await toggleFavorite(name);
    setLastAdded(`${name} (${safe}) ★`);
    setFilterMode("all");
    setSearchQuery("");
  };

  // Clear all confirm
  const handleClearAllWithConfirm = () => {
    if (!skills.length) return;

    Alert.alert("Remove all skills?", "This will clear your learning list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: () => clearAllSkills(),
      },
    ]);
  };

  // Category selection
  const handleSelectCategory = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedSubCategoryId(null);
    setFilterMode("all");
    setSearchQuery("");
    showToast("Category selected", "info");
  };

  const handleSelectSubCategory = (id: string | null) => {
    setSelectedSubCategoryId(id);
    setFilterMode("all");
    setSearchQuery("");
  };

  // ---------- Bottom Sheet logic (9 + 10 + 11 + 12) ----------
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

  // (11) open edit level sheet
  const openEditLevelSheet = (skill: SkillToLearn) => {
    setDuplicateExisting(null);
    setSheetMode("editLevel");
    setSheetSkillName(skill.name);
    setSheetSelectedLevel(skill.level);
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  const confirmSheetAction = async () => {
    // ----- QUICK ADD -----
    if (sheetMode === "quickAdd") {
      const name = sheetSkillName.trim();
      if (!name) {
        showToast("Type a skill name first.", "error");
        return;
      }

      // (12) smart add
      const res = await addSkillSmart(name, sheetSelectedLevel);
      if (res.ok) {
        setLastAdded(`${res.skill.name} (${res.skill.level})`);
        setFilterMode("all");
        setSearchQuery("");
        closeSheet();
        return;
      }

      if (!res.ok && res.existed) {
        // show duplicate UI: offer edit level
        setDuplicateExisting(res.existing);
        showToast("Skill already exists — edit its level?", "info");
        // switch to edit mode but keep modal open
        setSheetMode("editLevel");
        setSheetSkillName(res.existing.name);
        setSheetSelectedLevel(res.existing.level);
        return;
      }

      showToast(res.error || "Could not add skill.", "error");
      return;
    }

    // ----- SUGGESTED ADD -----
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

    // ----- ADD ALL SUGGESTED -----
    if (sheetMode === "addAllSuggested") {
      if (!suggestedSkillsByCategory.length) return;

      // add all; duplicates will be skipped silently using addSkill
      for (const skillName of suggestedSkillsByCategory) {
        await addSkill(skillName, sheetSelectedLevel);
      }
      setFilterMode("all");
      setSearchQuery("");
      showToast(
        `Added ${suggestedSkillsByCategory.length} skills (${sheetSelectedLevel})`,
        "success"
      );
      closeSheet();
      return;
    }

    // ----- EDIT LEVEL (11) -----
    if (sheetMode === "editLevel") {
      const ok = await updateSkillLevel(sheetSkillName, sheetSelectedLevel);
      if (ok) {
        showToast(`Updated level for ${sheetSkillName}`, "success");
        closeSheet();
      }
      return;
    }
  };
  const stats = useMemo(() => {
    const total = skills.length;
    const fav = favoriteSkills.length;

    const levelCounts: Record<string, number> = {};
    for (const s of skills) {
      levelCounts[s.level] = (levelCounts[s.level] ?? 0) + 1;
    }
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

  // loading
  if (loadingInitial) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your skills...</Text>
      </View>
    );
  }

  // (20) stats

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f4f4f5" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Toast */}
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
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Skills you want to learn</Text>
        <Text style={styles.subtitle}>
          Choose a category then add skills with the right level for better
          matching.
        </Text>

        {/* Pending sync indicator (22) */}
        {hasPendingSync && (
          <View style={styles.pendingSyncBar}>
            <Text style={styles.pendingSyncText}>
              ⏳ Saved locally — syncing when online
            </Text>
          </View>
        )}

        {/* Global Search */}
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
            Search filters your learning list.
          </Text>
        </View>

        {/* Steps */}
        <View style={styles.stepsRow}>
          <View
            style={[styles.stepPill, isStep1Active && styles.stepPillActive]}
          >
            <Text style={styles.stepPillNumber}>1</Text>
            <Text style={styles.stepPillText}>Category</Text>
          </View>
          <View
            style={[styles.stepPill, isStep2Active && styles.stepPillActive]}
          >
            <Text style={styles.stepPillNumber}>2</Text>
            <Text style={styles.stepPillText}>Sub-category</Text>
          </View>
          <View
            style={[styles.stepPill, isStep3Active && styles.stepPillActive]}
          >
            <Text style={styles.stepPillNumber}>3</Text>
            <Text style={styles.stepPillText}>Your list</Text>
          </View>
        </View>

        {/* Quick Start */}
        {showQuickStart && (
          <View style={styles.quickStartCard}>
            <View style={styles.quickStartHeader}>
              <Text style={styles.quickStartTitle}>🚀 Quick start</Text>
              <TouchableOpacity onPress={dismissQuickStart} activeOpacity={0.8}>
                <Text style={styles.quickStartDismiss}>Got it</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.quickStartText}>
              1) Pick a category {"\n"}
              2) Tap a suggested skill {"\n"}
              3) Choose your level and add
            </Text>
          </View>
        )}

        {/* Error box */}
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

        {/* Category */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🧭 1. Category & sub-category</Text>
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

        {/* Discover */}
        {showDiscoverSection && (
          <>
            <Text style={styles.mainSectionTitle}>
              🔍 2. Discover skills to add
            </Text>

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
                title="Popular among SkillSwap learners"
                description="Skills many people are currently focusing on."
                skills={GLOBAL_POPULAR_SKILLS}
                onAdd={(name) => openSuggestedAddSheet(name)}
                existingSkills={skills.map((s) => s.name)}
                favoriteSkills={favoriteSkills}
              />
            )}
          </>
        )}

        {/* Add form (still available) */}
        <AddSkillToLearnForm
          onAdd={handleAddSkillBase}
          onAddFavorite={handleAddSkillAndFavorite}
          isSaving={saving}
          suggestionPool={suggestionPoolForInput}
          placeholderHint={dynamicPlaceholder}
        />

        {/* Your list */}
        {showYourListSection && (
          <>
            <Text style={styles.mainSectionTitle}>
              📌 3. Your learning list
            </Text>

            {/* (20) Stats */}
            <View style={styles.statsCard}>
              <Text style={styles.statsText}>
                {stats.total} skills • {stats.fav} favorites
                {stats.topLevel ? ` • Top level: ${stats.topLevel}` : ""}
              </Text>
              <Text style={styles.statsHint}>
                Tip: to edit a level, open “Add” and type the same skill name.
              </Text>
            </View>

            <Text style={styles.recentHint}>
              Recent = your last 6 added skills.
            </Text>

            {skills.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No skills yet</Text>
                <Text style={styles.emptyStateText}>
                  Start by picking a category above, or tap + to add a custom
                  skill quickly.
                </Text>

                <View style={styles.emptyStateButtons}>
                  <TouchableOpacity
                    style={styles.emptyPrimaryBtn}
                    onPress={() =>
                      showToast("Pick a category above 👆", "info")
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emptyPrimaryText}>Pick a category</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emptySecondaryBtn}
                    onPress={openQuickAddSheet}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emptySecondaryText}>
                      Add custom skill
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <SkillsToLearnList
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
              />
            )}
          </>
        )}

        {/* Undo bar */}
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

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, saving && { opacity: 0.6 }]}
        onPress={openQuickAddSheet}
        activeOpacity={0.85}
        disabled={saving}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Bottom Sheet modal */}
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

          {/* Duplicate helper card (12) */}
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
                placeholder="e.g. React Native"
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
              {LEARN_LEVELS.slice(0, 4).map((lvl) => {
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
            Tip: You can also add from the main form below.
          </Text>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 8, fontSize: 14, color: "#4b5563" },

  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  backText: { fontSize: 14, color: "#3b82f6" },

  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginTop: 8 },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },

  pendingSyncBar: {
    marginTop: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  pendingSyncText: {
    fontSize: 12,
    color: "#9a3412",
    fontWeight: "700",
  },

  globalSearchWrap: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  globalSearchLabel: { fontSize: 12, fontWeight: "600", color: "#4b5563" },
  globalSearchInput: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  globalSearchHint: { marginTop: 6, fontSize: 11, color: "#6b7280" },

  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 12,
    gap: 8,
  },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  stepPillActive: { backgroundColor: "#2563eb" },
  stepPillNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    marginRight: 4,
  },
  stepPillText: { fontSize: 12, color: "#111827", fontWeight: "500" },

  quickStartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  quickStartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  quickStartTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  quickStartDismiss: { fontSize: 12, fontWeight: "600", color: "#2563eb" },
  quickStartText: { fontSize: 12, color: "#4b5563", lineHeight: 18 },

  errorBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#b91c1c",
    marginBottom: 2,
  },
  errorText: { fontSize: 13, color: "#b91c1c" },
  errorHint: { fontSize: 11, color: "#7f1d1d", marginTop: 4 },

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
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  sectionDescription: { fontSize: 13, color: "#6b7280", marginBottom: 8 },

  breadcrumbBar: {
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  breadcrumbLabel: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  breadcrumbText: { fontSize: 12, color: "#111827" },

  mainSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginTop: 12,
    marginBottom: 6,
  },

  statsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  statsText: { fontSize: 13, color: "#111827", fontWeight: "800" },
  statsHint: { marginTop: 4, fontSize: 11, color: "#6b7280" },

  recentHint: { fontSize: 11, color: "#6b7280", marginBottom: 8 },

  undoBar: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoText: { fontSize: 13, color: "#374151" },
  undoButtonText: { fontSize: 13, fontWeight: "700", color: "#2563eb" },

  emptyStateCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyStateTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  emptyStateText: { marginTop: 6, fontSize: 13, color: "#6b7280" },
  emptyStateButtons: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  emptyPrimaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyPrimaryText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  emptySecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  emptySecondaryText: { color: "#374151", fontWeight: "700", fontSize: 13 },

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
  toastText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },

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
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },

  duplicateCard: {
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  duplicateTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  duplicateText: { marginTop: 4, fontSize: 12, color: "#374151" },
  duplicateHint: { marginTop: 4, fontSize: 11, color: "#6b7280" },

  sheetLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
  },
  sheetInput: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },

  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  levelPillActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  levelPillText: { fontSize: 12, color: "#374151", fontWeight: "700" },
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
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  sheetBtnSecondaryText: { color: "#374151", fontWeight: "800", fontSize: 13 },
  sheetBtnPrimary: { backgroundColor: "#2563eb" },
  sheetBtnPrimaryText: { color: "#ffffff", fontWeight: "900", fontSize: 13 },

  sheetHint: { marginTop: 10, fontSize: 11, color: "#6b7280" },
});
