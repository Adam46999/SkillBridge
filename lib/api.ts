// lib/api.ts
import Constants from "expo-constants";
import { Platform } from "react-native";

function getDevHostFromExpo(): string | null {
  // Expo dev host (often available in dev mode)
  const anyConst = Constants as any;

  // common places across SDKs
  const debuggerHost: string | undefined = anyConst?.debuggerHost;
  const hostUri: string | undefined = anyConst?.expoConfig?.hostUri;

  const raw = debuggerHost || hostUri || "";
  if (!raw) return null;

  // examples:
  // "192.168.1.50:8081"
  // "exp://192.168.1.50:8081"
  // "http://192.168.1.50:8081"
  const cleaned = raw
    .replace("exp://", "")
    .replace("http://", "")
    .replace("https://", "");
  const host = cleaned.split(":")[0]?.trim();
  return host || null;
}

function resolveApiUrl(): string {
  const envUrlRaw = (process.env.EXPO_PUBLIC_API_URL || "").trim();

  // In Web we can safely use localhost if server is on same machine
  if (Platform.OS === "web") {
    // Prefer explicit env if provided
    if (envUrlRaw) return envUrlRaw;

    const host =
      (typeof window !== "undefined" && window.location?.hostname) || "localhost";
    return `http://${host}:4000`;
  }

  // Native (Android/iOS)
  // If user mistakenly set localhost in env, it breaks real devices.
  // We'll ignore localhost env on native and auto-resolve correctly.
  const envIsLocalhost =
    envUrlRaw.includes("localhost") || envUrlRaw.includes("127.0.0.1");

  if (envUrlRaw && !envIsLocalhost) {
    return envUrlRaw;
  }

  const hostFromExpo = getDevHostFromExpo();

  // Android emulator special-case
  if (Platform.OS === "android") {
    if (!hostFromExpo) return "http://10.0.2.2:4000";
    if (hostFromExpo === "localhost" || hostFromExpo === "127.0.0.1") {
      return "http://10.0.2.2:4000";
    }
    return `http://${hostFromExpo}:4000`;
  }

  // iOS simulator / real device
  if (hostFromExpo) return `http://${hostFromExpo}:4000`;

  // Last fallback
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
export type SkillLearn = { name: string; level: string };

export type MentorMatch = {
  mentorId: string;
  fullName: string;
  matchScore: number;
  mainMatchedSkill?: { name: string; level: string; similarityScore: number };
  skillsToTeach?: SkillTeach[];
  availabilitySlots?: AvailabilitySlot[];
};

export type MatchingMode = "local" | "openai" | "hybrid";

export type MatchingStatus = {
  openaiAvailable: boolean;
  reason: "OK" | "NO_KEY" | "ERROR" | string;
  recommendedMode: "local" | "hybrid";
};

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

export async function updateSkillsToTeach(token: string, skillsToTeach: SkillTeach[]) {
  return updateProfile(token, { skillsToTeach });
}

export async function updateSkillsToLearn(token: string, skillsToLearn: SkillLearn[]) {
  return updateProfile(token, { skillsToLearn });
}

// ---------- MATCHING STATUS ----------
export async function getMatchingStatus(): Promise<MatchingStatus> {
  const res = await fetch(`${API_URL}/api/matching/status`, { method: "GET" });
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
      mode: params.mode,
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

export async function getPublicUserProfile(token: string, userId: string): Promise<PublicUserProfile> {
  const res = await fetch(`${API_URL}/api/users/${userId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

// ---------- UPLOADS (Conversation files) ----------
export async function uploadConversationFile(
  token: string,
  conversationId: string,
  file: { uri: string; name: string; type?: string }
) {
  const fd = new FormData();

  // For React Native / Expo: pass { uri, name, type }
  // For web: `file` can be a real File object and appended directly.
  if (typeof (file as any) === "object" && (file as any).uri) {
    fd.append("file", (file as any));
  } else {
    fd.append("file", file as any);
  }

  const res = await fetch(`${API_URL}/api/chat/${conversationId}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    } as Record<string,string>,
    body: fd as unknown as BodyInit,
  });

  return handleResponse(res);
}
