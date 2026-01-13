// app/sessions/api/sessionsApi.ts
import { API_URL } from "../../../lib/api";

export type SessionStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed";

export type PickedUser = {
  id: string;
  fullName: string;
  email: string;
  points?: number;
  xp?: number;
  streak?: number;
  avgRating?: number;
  ratingCount?: number;
};

export type SessionDTO = {
  _id: string;

  mentorId: any;
  learnerId: any;

  mentor?: PickedUser | null;
  learner?: PickedUser | null;

  skill: string;
  level: string;
  scheduledAt: string;
  status: SessionStatus;

  note?: string;

  joinedAt?: string | null;
  joinedBy?: any[];

  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  cancelledBy?: any | null;

  deleteNotice?: string | null;

  hiddenFor?: any[];

  rating?: number | null;
  feedback?: string;
};

async function apiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error || "Request failed";
    const err: any = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

export async function listMySessions(token: string): Promise<SessionDTO[]> {
  const r = await apiFetch<{ sessions: SessionDTO[] }>(
    "/api/sessions/mine",
    token
  );
  return r.sessions || [];
}
export type RequestSessionPayload = {
  mentorId: string;
  skill: string;
  level: string;
  scheduledAt: string; // ISO
  note?: string;
};

export async function requestSession(
  token: string,
  payload: RequestSessionPayload
): Promise<SessionDTO> {
  const r = await apiFetch<{ session: SessionDTO }>(
    "/api/sessions",
    token,
    { method: "POST", body: JSON.stringify(payload) }
  );
  return r.session;
}

export async function updateSessionStatus(
  token: string,
  sessionId: string,
  status: SessionStatus
): Promise<SessionDTO> {
  const r = await apiFetch<{ session: SessionDTO }>(
    `/api/sessions/${sessionId}/status`,
    token,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
  return r.session;
}

export async function joinSession(
  token: string,
  sessionId: string
): Promise<SessionDTO> {
  const r = await apiFetch<{ session: SessionDTO }>(
    `/api/sessions/${sessionId}/join`,
    token,
    { method: "POST" }
  );
  return r.session;
}

export async function rateSession(
  token: string,
  sessionId: string,
  payload: { rating: number; feedback?: string }
): Promise<{ ok: boolean; rating: number | null }> {
  return apiFetch(`/api/sessions/${sessionId}/rate`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ✅ NEW: Smart Delete
export async function deleteSessionSmart(
  token: string,
  sessionId: string
): Promise<{ ok: boolean; action: string }> {
  return apiFetch(`/api/sessions/${sessionId}/delete`, token, {
    method: "POST",
  });
}
