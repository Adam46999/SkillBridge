// app/manage-skills-to-learn/useManageSkillsToLearn.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { getMe, updateProfile } from "../../lib/api";
import {
  ALL_KNOWN_SKILLS,
  RECOMMENDED_SKILLS,
  SKILL_CATEGORIES,
  SkillCategory,
  SkillSubCategory,
} from "./skillData";
import { LEARN_LEVELS, LearnLevel, SkillToLearn, UndoState } from "./types";

const FAVORITES_STORAGE_KEY = "skillsToLearnFavorites";

// (22) offline pending sync
const PENDING_SKILLS_KEY = "skillsToLearn_pending_v1";

type AddSmartResult =
  | { ok: true; existed: false; skill: SkillToLearn }
  | { ok: false; existed: true; existing: SkillToLearn }
  | { ok: false; existed: false; error: string };

// normalize level
function normalizeLearnLevel(raw?: string | null): LearnLevel {
  if (!raw) return "Not specified";
  const trimmed = String(raw).trim();
  const found = LEARN_LEVELS.find((lvl) => lvl === trimmed);
  return found ?? "Not specified";
}

function normalizeName(raw: string) {
  return String(raw || "").trim();
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function useManageSkillsToLearn() {
  const [skills, setSkills] = useState<SkillToLearn[]>([]);
  const [favoriteSkills, setFavoriteSkills] = useState<string[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRemoved, setLastRemoved] = useState<UndoState>(null);

  // (22) indicates we have unsynced local changes
  const [hasPendingSync, setHasPendingSync] = useState(false);

  // category / subcategory
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

  // ---------- helpers ----------
  function findExistingSkill(name: string): SkillToLearn | null {
    const trimmed = normalizeName(name);
    if (!trimmed) return null;
    const found = skills.find((s) => sameName(s.name, trimmed));
    return found ?? null;
  }

  // (22) store pending local changes when backend update fails
  async function savePendingSkills(next: SkillToLearn[]) {
    try {
      await AsyncStorage.setItem(PENDING_SKILLS_KEY, JSON.stringify(next));
      setHasPendingSync(true);
    } catch (e) {
      console.log("savePendingSkills error:", e);
    }
  }

  async function clearPendingSkills() {
    try {
      await AsyncStorage.removeItem(PENDING_SKILLS_KEY);
      setHasPendingSync(false);
    } catch (e) {
      console.log("clearPendingSkills error:", e);
    }
  }

  async function loadPendingSkills(): Promise<SkillToLearn[] | null> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_SKILLS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;

      const clean: SkillToLearn[] = parsed
        .map((item: any) => {
          if (!item || typeof item !== "object") return null;
          if (typeof item.name !== "string") return null;
          const name = normalizeName(item.name);
          if (!name) return null;
          return {
            name,
            level: normalizeLearnLevel(item.level),
          } as SkillToLearn;
        })
        .filter(Boolean) as SkillToLearn[];

      return clean.length ? clean : [];
    } catch (e) {
      console.log("loadPendingSkills error:", e);
      return null;
    }
  }

  // (22) try to sync pending changes to backend
  async function trySyncPending() {
    try {
      const token = await getTokenOrFail();
      if (!token) return;

      const pending = await loadPendingSkills();
      if (pending === null) {
        setHasPendingSync(false);
        return;
      }

      // if there are pending changes, push them
      await updateProfile(token, { skillsToLearn: pending });
      await clearPendingSkills();

      // make sure local state matches pending
      setSkills([...pending].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      // stay pending
      console.log("trySyncPending error:", e);
      setHasPendingSync(true);
    }
  }

  // ---- load from backend + favorites local ----
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoadingInitial(true);
      setError(null);

      try {
        const token = await getTokenOrFail();
        if (!token) return;

        // (22) attempt sync pending first
        await trySyncPending();

        const me: any = await getMe(token);
        const userFromApi = me?.user ?? me;

        // NOTE: backend old format could be string[] OR new format object[]
        const raw = Array.isArray(userFromApi?.skillsToLearn)
          ? userFromApi.skillsToLearn
          : [];

        const cleanSkills: SkillToLearn[] = raw
          .map((item: any) => {
            // string -> object
            if (typeof item === "string") {
              const name = normalizeName(item);
              if (!name) return null;
              return { name, level: "Not specified" as LearnLevel };
            }

            // object -> normalize
            if (
              item &&
              typeof item === "object" &&
              typeof item.name === "string"
            ) {
              const name = normalizeName(item.name);
              if (!name) return null;
              return {
                name,
                level: normalizeLearnLevel(item.level),
              } as SkillToLearn;
            }

            return null;
          })
          .filter(Boolean) as SkillToLearn[];

        // sort by name
        cleanSkills.sort((a, b) => a.name.localeCompare(b.name));

        if (!isMounted) return;
        setSkills(cleanSkills);

        // favorites local
        const favJson = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (favJson && isMounted) {
          const parsed = JSON.parse(favJson);
          if (Array.isArray(parsed)) {
            setFavoriteSkills(parsed.filter((x) => typeof x === "string"));
          }
        }

        // pending indicator
        const pending = await AsyncStorage.getItem(PENDING_SKILLS_KEY);
        if (isMounted) setHasPendingSync(!!pending);
      } catch (e: any) {
        console.log("useManageSkillsToLearn load error:", e);
        if (isMounted) {
          setError(e?.message || "Failed to load learning skills");
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // ---- persist skills to backend ----
  async function persistSkills(next: SkillToLearn[]) {
    setSaving(true);
    setError(null);

    try {
      const token = await getTokenOrFail();
      if (!token) return;

      await updateProfile(token, {
        skillsToLearn: next,
      });

      // if this succeeds, clear pending
      await clearPendingSkills();
    } catch (e: any) {
      console.log("updateProfile(skillsToLearn) error:", e);

      // (22) store pending changes locally
      await savePendingSkills(next);

      setError(
        e?.message ||
          "Failed to save learning skills. Your changes are saved locally and will sync when you're back online."
      );
    } finally {
      setSaving(false);
    }
  }

  // ---- persist favorites local ----
  async function persistFavorites(next: string[]) {
    setFavoriteSkills(next);
    try {
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.log("persistFavorites learn error:", e);
    }
  }

  // ---- add skill (kept the same signature: boolean) ----
  async function addSkill(name: string, level?: LearnLevel): Promise<boolean> {
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

    const newSkill: SkillToLearn = {
      name: trimmed,
      level: normalizeLearnLevel(level ?? "Not specified"),
    };

    const next = [...skills, newSkill].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    setSkills(next);
    setLastRemoved(null);
    await persistSkills(next);
    return true;
  }

  // ---- (12) add skill smart: tells you if it exists and returns existing skill ----
  async function addSkillSmart(
    name: string,
    level?: LearnLevel
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
      // don't set as a hard error; this is a "smart" signal
      return { ok: false, existed: true, existing };
    }

    const newSkill: SkillToLearn = {
      name: trimmed,
      level: normalizeLearnLevel(level ?? "Not specified"),
    };

    const next = [...skills, newSkill].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    setSkills(next);
    setLastRemoved(null);
    await persistSkills(next);

    return { ok: true, existed: false, skill: newSkill };
  }

  // ---- (11) update level for an existing skill ----
  async function updateSkillLevel(
    name: string,
    newLevel: LearnLevel
  ): Promise<boolean> {
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

    const normalizedLevel = normalizeLearnLevel(newLevel);
    const current = skills[idx];
    if (current.level === normalizedLevel) return true;

    const next = [...skills];
    next[idx] = { ...current, level: normalizedLevel };

    // keep alphabetical order stable
    next.sort((a, b) => a.name.localeCompare(b.name));

    setSkills(next);
    await persistSkills(next);
    return true;
  }

  // ---- remove skill (accept SkillToLearn object) ----
  async function removeSkill(skill: SkillToLearn) {
    const skillName = skill.name;

    const index = skills.findIndex((s) => sameName(s.name, skillName));
    if (index === -1) return;

    const removed = skills[index];
    const next = skills.filter((_, i) => i !== index);

    setSkills(next);
    setLastRemoved({ skill: removed, index });

    // remove from favorites if needed
    const favExists = favoriteSkills.some((f) => sameName(f, removed.name));
    if (favExists) {
      const nextFav = favoriteSkills.filter((f) => !sameName(f, removed.name));
      await persistFavorites(nextFav);
    }

    await persistSkills(next);
  }

  // ---- clear all ----
  async function clearAllSkills() {
    const next: SkillToLearn[] = [];
    setSkills(next);
    setLastRemoved(null);

    await persistFavorites([]);
    await persistSkills(next);
  }

  // ---- undo remove ----
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

  // ---- toggle favorite ----
  async function toggleFavorite(name: string) {
    const exists = favoriteSkills.some((f) => sameName(f, name));

    let next: string[];
    if (exists) {
      next = favoriteSkills.filter((f) => !sameName(f, name));
    } else {
      next = [...favoriteSkills, name];
    }

    await persistFavorites(next);
  }

  function clearError() {
    setError(null);
  }

  // ---- category helpers ----
  const selectedCategory: SkillCategory | undefined = useMemo(
    () => SKILL_CATEGORIES.find((c) => c.id === selectedCategoryId),
    [selectedCategoryId]
  );

  const subCategories: SkillSubCategory[] =
    selectedCategory?.subCategories ?? [];

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

  // ---- filtered + sorted (favorites first) ----
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
    hasPendingSync, // (22)

    // category stuff
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

    addSkill, // keep old
    addSkillSmart, // (12) new
    updateSkillLevel, // (11) new
    trySyncPending, // (22) new

    removeSkill,
    undoRemove,
    clearAllSkills,
    toggleFavorite,
    clearError,
  };
}
