// lib/availabilityStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AvailabilitySlot } from "./api";
import { patchSectionStatus } from "./sectionStatus"; // ✅ update Home status too

// ✅ Keys (versioned to avoid future breaking)
const KEY_LAST_SAVED_AT = "weeklyAvailability_lastSavedAt_v1";
const KEY_PENDING = "weeklyAvailability_pending_v1";

/**
 * The pending payload stored locally when user edits availability
 * but hasn't synced to server yet.
 */
export type PendingAvailabilityPayload = {
  slots: AvailabilitySlot[];
  updatedAtISO: string; // when user changed locally
  source: "user-edit" | "auto-restore";
};

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getWeeklyLastSavedAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_LAST_SAVED_AT);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * ✅ IMPORTANT:
 * - write local timestamp
 * - also patch sectionStatus so HomeScreen reflects it immediately
 */
export async function setWeeklyLastSavedAt(
  ts: number = Date.now()
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_LAST_SAVED_AT, String(ts));
  } catch {
    // swallow - we don't want UI crash
  }

  // keep Home in sync (ignore errors safely)
  try {
    await patchSectionStatus({ weeklyAvailabilityLastSavedAt: ts });
  } catch {
    // ignore
  }
}

export async function clearWeeklyLastSavedAt(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_LAST_SAVED_AT);
  } catch {
    // ignore
  }

  // keep Home in sync
  try {
    await patchSectionStatus({ weeklyAvailabilityLastSavedAt: null });
  } catch {
    // ignore
  }
}

export async function getPendingWeeklyAvailability(): Promise<PendingAvailabilityPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PENDING);
    const parsed = safeParseJSON<PendingAvailabilityPayload>(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.slots) ||
      typeof parsed.updatedAtISO !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setPendingWeeklyAvailability(
  slots: AvailabilitySlot[],
  source: PendingAvailabilityPayload["source"] = "user-edit"
): Promise<void> {
  try {
    const payload: PendingAvailabilityPayload = {
      slots,
      updatedAtISO: new Date().toISOString(),
      source,
    };
    await AsyncStorage.setItem(KEY_PENDING, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export async function clearPendingWeeklyAvailability(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_PENDING);
  } catch {
    // ignore
  }
}

/**
 * Convenience: mark "saved successfully" (server sync succeeded)
 * - clear pending
 * - bump lastSavedAt (and Home status)
 */
export async function markWeeklyAvailabilitySynced(): Promise<void> {
  await Promise.all([
    clearPendingWeeklyAvailability(),
    setWeeklyLastSavedAt(Date.now()), // ✅ this also patches sectionStatus
  ]);
}

/**
 * Use this when entering weekly availability screen:
 * If there is a pending payload, you can offer restore.
 */
export async function hasPendingWeeklyAvailability(): Promise<boolean> {
  const p = await getPendingWeeklyAvailability();
  return !!p?.slots?.length;
}
