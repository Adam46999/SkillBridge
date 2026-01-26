// app/manage-skills-to-teach/useManageSkillsToTeach.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { getMe, updateProfile } from "../../lib/api";

// ✅ reuse learn data + categories
import {
  ALL_KNOWN_SKILLS,
  RECOMMENDED_SKILLS,
  SKILL_CATEGORIES,
  SkillCategory,
  SkillSubCategory,
} from "../manage-skills-to-learn/skillData";

import { Level, SkillTeach, TEACH_LEVELS, UndoState } from "./types";

const FAVORITES_STORAGE_KEY = "skillsToTeachFavorites";
const PENDING_KEY = "skillsToTeach_pending_v1";

type AddSmartResult =
  | { ok: true; existed: false; skill: SkillTeach }
  | { ok: false; existed: true; existing: SkillTeach }
  | { ok: false; existed: false; error: string };

function normalizeLevel(raw?: string | null): Level {
  if (!raw) return "Not specified";
  const trimmed = String(raw).trim();
  const found = TEACH_LEVELS.find((lvl) => lvl === trimmed);
  return found ?? "Not specified";
}

function normalizeName(raw: string) {
  return String(raw || "").trim();
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function useManageSkillsToTeach() {
  const [skills, setSkills] = useState<SkillTeach[]>([]);
  const [favoriteSkills, setFavoriteSkills] = useState<string[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRemoved, setLastRemoved] = useState<UndoState>(null);

  const [hasPendingSync, setHasPendingSync] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    string | null
  >(null);

  async function getTokenOrFail(): Promise<string | null> {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      setError("You are not logged in. Please log in again.");
      return null;
    }
    return token;
  }

  function findExistingSkill(name: string): SkillTeach | null {
    const trimmed = normalizeName(name);
    if (!trimmed) return null;
    const found = skills.find((s) => sameName(s.name, trimmed));
    return found ?? null;
  }

  async function savePending(next: SkillTeach[]) {
    try {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
      setHasPendingSync(true);
    } catch (e) {
      console.log("savePending teach error:", e);
    }
  }

  async function clearPending() {
    try {
      await AsyncStorage.removeItem(PENDING_KEY);
      setHasPendingSync(false);
    } catch (e) {
      console.log("clearPending teach error:", e);
    }
  }

  async function loadPending(): Promise<SkillTeach[] | null> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;

      const clean: SkillTeach[] = parsed
        .map((item: any) => {
          if (!item || typeof item !== "object") return null;
          if (typeof item.name !== "string") return null;
          const name = normalizeName(item.name);
          if (!name) return null;
          return { name, level: normalizeLevel(item.level) } as SkillTeach;
        })
        .filter(Boolean) as SkillTeach[];

      return clean.length ? clean : [];
    } catch (e) {
      console.log("loadPending teach error:", e);
      return null;
    }
  }

  async function trySyncPending() {
    try {
      const token = await getTokenOrFail();
      if (!token) return;

      const pending = await loadPending();
      if (pending === null) {
        setHasPendingSync(false);
        return;
      }

      await updateProfile(token, { skillsToTeach: pending });
      await clearPending();

      setSkills([...pending].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.log("trySyncPending teach error:", e);
      setHasPendingSync(true);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoadingInitial(true);
      setError(null);

      try {
        const token = await getTokenOrFail();
        if (!token) return;

        await trySyncPending();

        const me: any = await getMe(token);
        const userFromApi = me?.user ?? me;

        const raw = Array.isArray(userFromApi?.skillsToTeach)
          ? userFromApi.skillsToTeach
          : [];

        const cleanSkills: SkillTeach[] = raw
          .map((item: any) => {
            if (typeof item === "string") {
              const name = normalizeName(item);
              if (!name) return null;
              return { name, level: "Not specified" as Level };
            }

            if (
              item &&
              typeof item === "object" &&
              typeof item.name === "string"
            ) {
              const name = normalizeName(item.name);
              if (!name) return null;
              return {
                name,
                level: normalizeLevel(item.level),
              } as SkillTeach;
            }

            return null;
          })
          .filter(Boolean) as SkillTeach[];

        cleanSkills.sort((a, b) => a.name.localeCompare(b.name));

        if (!isMounted) return;
        setSkills(cleanSkills);

        const favJson = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (favJson && isMounted) {
          const parsed = JSON.parse(favJson);
          if (Array.isArray(parsed)) {
            setFavoriteSkills(parsed.filter((x) => typeof x === "string"));
          }
        }

        const pending = await AsyncStorage.getItem(PENDING_KEY);
        if (isMounted) setHasPendingSync(!!pending);
      } catch (e: any) {
        console.log("useManageSkillsToTeach load error:", e);
        if (isMounted) {
          setError(e?.message || "Failed to load teaching skills");
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
    // intentionally run once on mount; trySyncPending is safe to call here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistSkills(next: SkillTeach[]) {
    setSaving(true);
    setError(null);

    try {
      const token = await getTokenOrFail();
      if (!token) return;

      await updateProfile(token, { skillsToTeach: next });
      await clearPending();
    } catch (e: any) {
      console.log("updateProfile(skillsToTeach) error:", e);
      await savePending(next);
      setError(
        e?.message ||
          "Failed to save teaching skills. Saved locally and will sync when online."
      );
    } finally {
      setSaving(false);
    }
  }

  async function persistFavorites(next: string[]) {
    setFavoriteSkills(next);
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.log("persistFavorites teach error:", e);
    }
  }

  async function addSkill(name: string, level?: Level): Promise<boolean> {
    const trimmed = normalizeName(name);

    if (!trimmed) {
      setError("Skill name cannot be empty.");
      return false;
    }
    if (trimmed.length < 2) {
      setError("Skill name is too short.");
      return false;
    }

    const exists = skills.some((s) => sameName(s.name, trimmed));
    if (exists) {
      setError("This skill is already in your list.");
      return false;
    }

    const newSkill: SkillTeach = {
      name: trimmed,
      level: normalizeLevel(level ?? "Not specified"),
    };

    const next = [...skills, newSkill].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    setSkills(next);
    setLastRemoved(null);
    await persistSkills(next);
    return true;
  }

  async function addSkillSmart(
    name: string,
    level?: Level
  ): Promise<AddSmartResult> {
    const trimmed = normalizeName(name);

    if (!trimmed) {
      const msg = "Skill name cannot be empty.";
      setError(msg);
      return { ok: false, existed: false, error: msg };
    }
    if (trimmed.length < 2) {
      const msg = "Skill name is too short.";
      setError(msg);
      return { ok: false, existed: false, error: msg };
    }

    const existing = findExistingSkill(trimmed);
    if (existing) {
      return { ok: false, existed: true, existing };
    }

    const newSkill: SkillTeach = {
      name: trimmed,
      level: normalizeLevel(level ?? "Not specified"),
    };

    const next = [...skills, newSkill].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    setSkills(next);
    setLastRemoved(null);
    await persistSkills(next);

    return { ok: true, existed: false, skill: newSkill };
  }

  async function updateSkillLevel(name: string, newLevel: Level) {
    const trimmed = normalizeName(name);
    if (!trimmed) {
      setError("Skill name cannot be empty.");
      return false;
    }

    const idx = skills.findIndex((s) => sameName(s.name, trimmed));
    if (idx === -1) {
      setError("Skill not found.");
      return false;
    }

    const normalized = normalizeLevel(newLevel);
    const current = skills[idx];
    if (current.level === normalized) return true;

    const next = [...skills];
    next[idx] = { ...current, level: normalized };
    next.sort((a, b) => a.name.localeCompare(b.name));

    setSkills(next);
    await persistSkills(next);
    return true;
  }

  async function removeSkill(skill: SkillTeach) {
    const index = skills.findIndex((s) => sameName(s.name, skill.name));
    if (index === -1) return;

    const removed = skills[index];
    const next = skills.filter((_, i) => i !== index);

    setSkills(next);
    setLastRemoved({ skill: removed, index });

    const favExists = favoriteSkills.some((f) => sameName(f, removed.name));
    if (favExists) {
      const nextFav = favoriteSkills.filter((f) => !sameName(f, removed.name));
      await persistFavorites(nextFav);
    }

    await persistSkills(next);
  }

  async function clearAllSkills() {
    const next: SkillTeach[] = [];
    setSkills(next);
    setLastRemoved(null);
    await persistFavorites([]);
    await persistSkills(next);
  }

  async function undoRemove() {
    if (!lastRemoved) return;

    const { skill, index } = lastRemoved;
    const next = [...skills];
    const safeIndex = index >= 0 && index <= next.length ? index : next.length;
    next.splice(safeIndex, 0, skill);
    next.sort((a, b) => a.name.localeCompare(b.name));

    setSkills(next);
    setLastRemoved(null);
    await persistSkills(next);
  }

  async function toggleFavorite(name: string) {
    const exists = favoriteSkills.some((f) => sameName(f, name));
    const next = exists
      ? favoriteSkills.filter((f) => !sameName(f, name))
      : [...favoriteSkills, name];

    await persistFavorites(next);
  }

  function clearError() {
    setError(null);
  }

  // ---------- category helpers (reuse learn data) ----------
  const selectedCategory: SkillCategory | undefined = useMemo(
    () => SKILL_CATEGORIES.find((c) => c.id === selectedCategoryId),
    [selectedCategoryId]
  );

  const subCategories: SkillSubCategory[] = useMemo(
    () => selectedCategory?.subCategories ?? [],
    [selectedCategory]
  );

  const selectedSubCategory: SkillSubCategory | undefined = useMemo(
    () => subCategories.find((s) => s.id === selectedSubCategoryId),
    [subCategories, selectedSubCategoryId]
  );

  const suggestedSkillsByCategory: string[] = useMemo(() => {
    if (selectedSubCategory) return selectedSubCategory.skills;
    if (selectedCategory)
      return selectedCategory.subCategories.flatMap((s) => s.skills);
    return [];
  }, [selectedCategory, selectedSubCategory]);

  const recommendedSkills = RECOMMENDED_SKILLS;

  const suggestionPoolForInput = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...ALL_KNOWN_SKILLS,
          ...recommendedSkills,
          ...skills.map((s) => s.name),
        ].filter((s) => typeof s === "string")
      )
    );
  }, [skills, recommendedSkills]);

  const filteredSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = !q
      ? skills
      : skills.filter((s) => s.name.toLowerCase().includes(q));

    return [...base].sort((a, b) => {
      const aFav = favoriteSkills.some((f) => sameName(f, a.name));
      const bFav = favoriteSkills.some((f) => sameName(f, b.name));
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [skills, favoriteSkills, searchQuery]);

  return {
    // data
    skills,
    filteredSkills,
    favoriteSkills,
    loadingInitial,
    saving,
    error,
    searchQuery,
    lastRemoved,
    hasPendingSync,

    // category
    selectedCategoryId,
    selectedSubCategoryId,
    selectedCategory,
    subCategories,
    selectedSubCategory,
    suggestedSkillsByCategory,
    recommendedSkills,
    suggestionPoolForInput,

    // actions
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
  };
}
