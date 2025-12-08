// lib/api.ts

// ⛔ لو بتستخدم موبايل حقيقي غيّر localhost إلى IP اللابتوب
// مثال: const BASE_URL = "http://192.168.1.23:4000";
const BASE_URL = "http://localhost:4000";

type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  points: number;
  xp: number;
  streak: number;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type AvailabilitySlot = {
  dayOfWeek: number; // 0-6
  from: string; // "18:00"
  to: string; // "19:00"
};

export type SkillTeach = {
  name: string;
  level: string;
};

export type UserProfile = {
  _id: string;
  fullName: string;
  email: string;
  points: number;
  xp: number;
  streak: number;
  skillsToLearn?: string[];
  skillsToTeach?: SkillTeach[];
  availabilitySlots?: AvailabilitySlot[];
};

// ---------- AUTH ----------

export async function signup(
  fullName: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, email, password }),
  });

  const data = await res.json().catch(() => ({}));
  console.log("Signup response:", data);

  if (!res.ok) {
    const message = (data && (data.error || data.details)) || "Signup failed";
    throw new Error(message);
  }

  return data;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  console.log("Login response:", data);

  if (!res.ok) {
    const message = (data && (data.error || data.details)) || "Login failed";
    throw new Error(message);
  }

  return data;
}

// ---------- PROFILE ----------

export async function getMe(token: string): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  console.log("getMe response:", data);

  if (!res.ok) {
    const message =
      (data && (data.error || data.details)) || "Failed to load user";
    throw new Error(message);
  }

  return data;
}

export async function updateProfile(
  token: string,
  payload: {
    skillsToLearn?: string[];
    skillsToTeach?: SkillTeach[];
    availabilitySlots?: AvailabilitySlot[];
  }
): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/api/me/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  console.log("updateProfile response:", data);

  if (!res.ok) {
    const message =
      (data && (data.error || data.details)) || "Failed to update profile";
    throw new Error(message);
  }

  return data;
}
