// lib/api.ts
import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return envUrl;

  const debuggerHost = (Constants as any)?.debuggerHost as string | undefined;
  let hostFromExpo: string | null = null;

  if (debuggerHost) hostFromExpo = debuggerHost.split(":")[0];
  else if (typeof window !== "undefined") hostFromExpo = window.location.hostname;

  if (hostFromExpo) {
    if (Platform.OS === "android") {
      if (hostFromExpo === "localhost" || hostFromExpo === "127.0.0.1") {
        return "http://10.0.2.2:4000";
      }
      return `http://${hostFromExpo}:4000`;
    }
    return `http://${hostFromExpo}:4000`;
  }

  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
}

export const API_URL = resolveApiUrl();
console.log("🔗 API_URL resolved to:", API_URL);

async function handleResponse(res: Response) {
  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    console.log("API ERROR =>", {
      url: res.url,
      status: res.status,
      rawBody: text,
      parsed: data,
    });

    const message =
      (data && (data as any).error) ||
      (data && (data as any).message) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${res.status}`;

    throw new Error(message);
  }

  return data;
}

// ---------- AUTH ----------
export async function signup(params: {
  fullName: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

export async function login(params: { email: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

// ---------- TYPES ----------
export type AvailabilitySlot = { dayOfWeek: number; from: string; to: string };

export type SkillTeach = { name: string; level: string };

// ✅ skillsToLearn objects (حسب السيرفر عندك)
export type SkillLearn = { name: string; level: string };

export type MentorMatch = {
  mentorId: string;
  fullName: string;
  matchScore: number;
  mainMatchedSkill?: { name: string; level: string; similarityScore: number };
  skillsToTeach?: SkillTeach[];
  availabilitySlots?: AvailabilitySlot[];
};

// ✅ NEW: matching mode (عشان تغيّر من داخل الأب)
export type MatchingMode = "local" | "openai" | "hybrid";

// ✅ NEW: matching status (preflight)
export type MatchingStatus = {
  openaiAvailable: boolean;
  reason: "OK" | "NO_KEY" | "ERROR" | string;
  recommendedMode: "local" | "hybrid";
};

// ✅ NEW: matching meta (returned with results)
export type MatchingMeta = {
  requestedMode: MatchingMode | null;
  modeUsed: MatchingMode | null;
  fallbackUsed: boolean;
  message?: string;
};

// ---------- USER ----------
export async function getMe(token: string) {
  const res = await fetch(`${API_URL}/api/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

// ---------- PROFILE UPDATE ----------
export async function updateProfile(
  token: string,
  partial: {
    skillsToLearn?: SkillLearn[];
    skillsToTeach?: SkillTeach[];
    availabilitySlots?: AvailabilitySlot[];
  }
) {
  const res = await fetch(`${API_URL}/api/me/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(partial),
  });

  return handleResponse(res);
}

export async function updateWeeklyAvailability(
  token: string,
  availabilitySlots: AvailabilitySlot[]
) {
  return updateProfile(token, { availabilitySlots });
}

export async function updateSkillsToTeach(
  token: string,
  skillsToTeach: SkillTeach[]
) {
  return updateProfile(token, { skillsToTeach });
}

export async function updateSkillsToLearn(
  token: string,
  skillsToLearn: SkillLearn[]
) {
  return updateProfile(token, { skillsToLearn });
}

// ---------- MATCHING STATUS ----------
export async function getMatchingStatus(): Promise<MatchingStatus> {
  const res = await fetch(`${API_URL}/api/matching/status`, {
    method: "GET",
  });
  return handleResponse(res);
}

// ---------- MATCHING ----------
export async function getMentorMatches(
  token: string,
  params: {
    skill: string;
    level: "Beginner" | "Intermediate" | "Advanced";
    availabilitySlots?: AvailabilitySlot[];
    mode?: MatchingMode;
  }
): Promise<{ results: MentorMatch[]; meta?: MatchingMeta }> {
  const res = await fetch(`${API_URL}/api/matches/mentors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      skill: params.skill,
      level: params.level,
      availabilitySlots: params.availabilitySlots ?? [],
      mode: params.mode, // لو بدك افتراضي خليها: params.mode ?? "local"
    }),
  });

  return handleResponse(res);
}
// ---------- PUBLIC USER PROFILE (Mentor) ----------
export type PublicUserProfile = {
  id: string;
  fullName: string;
  points: number;
  xp: number;
  streak: number;
  avgRating: number;
  ratingCount: number;
  skillsToTeach: SkillTeach[];
  availabilitySlots: AvailabilitySlot[];
  preferences?: { communicationModes?: string[]; languages?: string[] };
};

export async function getPublicUserProfile(
  token: string,
  userId: string
): Promise<PublicUserProfile> {
  const res = await fetch(`${API_URL}/api/users/${userId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}
