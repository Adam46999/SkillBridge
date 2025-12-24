// app/sessions/api/sessionsApi.ts
import { API_URL } from "../../../lib/api";

export type SessionStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed";

export type SessionDTO = {
  _id: string;

  mentorId: string;
  learnerId: string;

  skill: string;
  level: string;

  scheduledAt: string; // ISO
  status: SessionStatus;

  note?: string;

  rating?: number | null;
  feedback?: string;

  createdAt?: string;
  updatedAt?: string;
};

async function handle(res: Response) {
  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export async function listMySessions(
  token: string,
  params?: {
    role?: "mentor" | "learner" | "any";
    scope?: "upcoming" | "past" | "all";
    statuses?: SessionStatus[];
  }
): Promise<SessionDTO[]> {
  const q = new URLSearchParams();
  if (params?.role) q.set("role", params.role);
  if (params?.scope) q.set("scope", params.scope);
  if (params?.statuses?.length) q.set("statuses", params.statuses.join(","));

  const url = `${API_URL}/api/sessions/mine${
    q.toString() ? `?${q.toString()}` : ""
  }`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await handle(res);
  return Array.isArray(data?.sessions) ? (data.sessions as SessionDTO[]) : [];
}

export async function requestSession(
  token: string,
  body: {
    mentorId: string;
    skill: string;
    level?: string;
    scheduledAt: string;
    note?: string;
  }
): Promise<SessionDTO> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await handle(res);
  return (data?.session ?? data) as SessionDTO;
}

export async function updateSessionStatus(
  token: string,
  sessionId: string,
  status: SessionStatus
): Promise<SessionDTO> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await handle(res);
  return (data?.session ?? data) as SessionDTO;
}

// ✅ NEW: rate session
export async function rateSession(
  token: string,
  sessionId: string,
  body: { rating: number; feedback?: string }
): Promise<SessionDTO> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/rate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await handle(res);
  return (data?.session ?? data) as SessionDTO;
}
