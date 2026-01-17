// app/weekly-availability/useWeeklyAvailability.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AvailabilitySlot,
  getMe,
  updateWeeklyAvailability,
} from "../../lib/api";

/**
 * Local key for "last saved" timestamp (used by Home + Weekly Availability)
 */
const WEEKLY_AVAIL_LAST_SAVED_KEY = "weeklyAvailability_lastSavedAt_v1";

/**
 * Sort slots by day, then time
 */
export function sortAvailability(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return [...slots].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.from.localeCompare(b.from);
  });
}

/**
 * Normalize + validate slots coming from API or UI
 */
function normalizeSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return sortAvailability(
    (Array.isArray(slots) ? slots : [])
      .filter(
        (s) =>
          typeof s?.dayOfWeek === "number" &&
          s.dayOfWeek >= 0 &&
          s.dayOfWeek <= 6 &&
          typeof s?.from === "string" &&
          typeof s?.to === "string" &&
          s.from.trim() &&
          s.to.trim()
      )
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        from: s.from.trim(),
        to: s.to.trim(),
      }))
  );
}

/**
 * Stable deep-equality key
 */
function slotsKey(slots: AvailabilitySlot[]): string {
  return normalizeSlots(slots)
    .map((s) => `${s.dayOfWeek}|${s.from}|${s.to}`)
    .join(";");
}

async function readLastSavedAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_AVAIL_LAST_SAVED_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function writeLastSavedAt(ts: number): Promise<void> {
  try {
    await AsyncStorage.setItem(WEEKLY_AVAIL_LAST_SAVED_KEY, String(ts));
  } catch {
    // ignore
  }
}

export type UserProfile = {
  _id: string;
  fullName: string;
  email: string;
  availabilitySlots?: AvailabilitySlot[];
  skillsToLearn?: any[];
  skillsToTeach?: any[];
};

type UseWeeklyAvailabilityResult = {
  user: UserProfile | null;
  availability: AvailabilitySlot[];
  loading: boolean;
  saving: boolean;
  errorText: string | null;
  hasChanges: boolean;
  lastSavedAt: number | null;

  reload: () => Promise<void>;
  save: () => Promise<boolean>;

  updateAvailability: (
    updater: (prev: AvailabilitySlot[]) => AvailabilitySlot[]
  ) => void;

  setErrorText: (t: string | null) => void;
};

export function useWeeklyAvailability(): UseWeeklyAvailabilityResult {
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  /**
   * Baseline snapshot to detect unsaved changes
   */
  const baselineKeyRef = useRef<string>("");

  const hasChanges = useMemo(() => {
    return slotsKey(availability) !== baselineKeyRef.current;
  }, [availability]);

  /**
   * Load profile + availability
   */
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setErrorText(null);

      // load lastSavedAt (fast + local)
      const savedTs = await readLastSavedAt();
      setLastSavedAt(savedTs);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        // ✅ keep consistent with your auth group routes
        router.replace("/(auth)/login");
        return;
      }

      const data = (await getMe(token)) as UserProfile;
      const normalized = normalizeSlots(data.availabilitySlots || []);

      setUser(data);
      setAvailability(normalized);
      baselineKeyRef.current = slotsKey(normalized);

      // If user already has availability from backend but no local timestamp yet,
      // set a helpful baseline timestamp once (not critical, but improves UX).
      if (!savedTs && normalized.length > 0) {
        const now = Date.now();
        setLastSavedAt(now);
        await writeLastSavedAt(now);
      }
    } catch (err: any) {
      console.log("weekly-availability / load error:", err);
      setErrorText(
        err?.message || "We couldn’t load your availability. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * Safe updater wrapper (always normalizes)
   */
  const updateAvailability = (
    updater: (prev: AvailabilitySlot[]) => AvailabilitySlot[]
  ) => {
    setAvailability((prev) => normalizeSlots(updater(prev)));
  };

  /**
   * Save changes to backend
   */
  const save = useCallback(async () => {
    // ✅ prevents double taps + saves only when needed
    if (saving || !hasChanges) return false;

    try {
      setSaving(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return false;
      }

      const normalized = normalizeSlots(availability);

      const updated = (await updateWeeklyAvailability(
        token,
        normalized
      )) as UserProfile;

      const updatedNormalized = normalizeSlots(updated.availabilitySlots || []);

      setUser(updated);
      setAvailability(updatedNormalized);
      baselineKeyRef.current = slotsKey(updatedNormalized);

      // ✅ write "last saved" timestamp for Home + other screens
      const now = Date.now();
      setLastSavedAt(now);
      await writeLastSavedAt(now);

      return true;
    } catch (err: any) {
      console.log("weekly-availability / save error:", err);
      setErrorText(
        err?.message || "Something went wrong while saving your availability."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [availability, hasChanges, router, saving]);

  return {
    user,
    availability,
    loading,
    saving,
    errorText,
    hasChanges,
    lastSavedAt,

    reload,
    save,
    updateAvailability,
    setErrorText,
  };
}
