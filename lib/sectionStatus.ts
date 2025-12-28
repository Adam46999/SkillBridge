// lib/sectionStatus.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "sectionStatus_v1";

export type SectionStatus = {
  weeklyAvailabilityLastSavedAt: number | null;
  learnHasPendingSync: boolean;
  teachHasPendingSync: boolean;
  updatedAt: number;
};

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function makeDefaultSectionStatus(
  overrides: Partial<SectionStatus> = {}
): SectionStatus {
  const now = Date.now();
  const next: SectionStatus = {
    weeklyAvailabilityLastSavedAt: null,
    learnHasPendingSync: false,
    teachHasPendingSync: false,
    updatedAt: now,
    ...overrides,
  };

  if (!(typeof next.updatedAt === "number" && Number.isFinite(next.updatedAt))) {
    next.updatedAt = now;
  }
  return next;
}

export function normalizeSectionStatus(input: unknown): SectionStatus {
  const obj = (input ?? {}) as Partial<SectionStatus>;

  const weeklyAvailabilityLastSavedAt =
    typeof obj.weeklyAvailabilityLastSavedAt === "number" &&
    Number.isFinite(obj.weeklyAvailabilityLastSavedAt)
      ? obj.weeklyAvailabilityLastSavedAt
      : null;

  const learnHasPendingSync = obj.learnHasPendingSync === true;
  const teachHasPendingSync = obj.teachHasPendingSync === true;

  const updatedAt =
    typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt)
      ? obj.updatedAt
      : Date.now();

  return {
    weeklyAvailabilityLastSavedAt,
    learnHasPendingSync,
    teachHasPendingSync,
    updatedAt,
  };
}

export async function readSectionStatus(): Promise<SectionStatus> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = safeJsonParse<SectionStatus>(raw);
  if (!parsed) return makeDefaultSectionStatus();
  return normalizeSectionStatus(parsed);
}

export async function writeSectionStatus(next: SectionStatus): Promise<void> {
  const normalized = normalizeSectionStatus(next);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export async function patchSectionStatus(
  patch: Partial<Omit<SectionStatus, "updatedAt">>
): Promise<SectionStatus> {
  const current = await readSectionStatus();
  const next: SectionStatus = { ...current, ...patch, updatedAt: Date.now() };
  await writeSectionStatus(next);
  return next;
}

export function formatTimeAgo(
  timestampMs: number,
  nowMs: number = Date.now()
): string {
  const diffMs = Math.max(0, nowMs - timestampMs);
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;

  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;

  const year = Math.floor(day / 365);
  return `${year}y ago`;
}
