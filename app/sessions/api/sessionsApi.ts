// app/sessions/api/sessionsApi.ts
import { API_URL } from "../../../lib/api";

export type SessionStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "cancelled" // UI/internal
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

async function fetchWithTimeout(url: string, options: RequestInit, ms = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Check API_URL / server.");
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

// ✅ UI -> API spelling (backend usually uses "canceled")
function statusForApi(status: SessionStatus) {
  return status === "cancelled" ? "canceled" : status;
}

// ✅ API -> UI spelling
function statusFromApi(status: any): SessionStatus {
  if (status === "canceled") return "cancelled";
  return status as SessionStatus;
}

function normalizeSessionFromApi(s: any): SessionDTO {
  return {
    ...s,
    status: statusFromApi(s?.status),
  } as SessionDTO;
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
  if (params?.statuses?.length) {
    q.set("statuses", params.statuses.map(statusForApi).join(","));
  }

  const url = `${API_URL}/api/sessions/mine${
    q.toString() ? `?${q.toString()}` : ""
  }`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
    12000
  );

  const data = await handle(res);
  const arr = Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data) ? data : [];
  return arr.map(normalizeSessionFromApi);
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
  const res = await fetchWithTimeout(
    `${API_URL}/api/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    12000
  );

  const data = await handle(res);
  const s = data?.session ?? data;
  return normalizeSessionFromApi(s);
}

export async function updateSessionStatus(
  token: string,
  sessionId: string,
  status: SessionStatus
): Promise<SessionDTO> {
  // ✅ log صح (جوا الفنكشن) لو بدك
  // console.log("[sessions] update status", sessionId, "=>", status);

  const res = await fetchWithTimeout(
    `${API_URL}/api/sessions/${sessionId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: statusForApi(status) }),
    },
    12000
  );

  const data = await handle(res);
  const s = data?.session ?? data;
  return normalizeSessionFromApi(s);
}

export async function rateSession(
  token: string,
  sessionId: string,
  body: { rating: number; feedback?: string }
): Promise<SessionDTO> {
  const res = await fetchWithTimeout(
    `${API_URL}/api/sessions/${sessionId}/rate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    12000
  );

  const data = await handle(res);
  const s = data?.session ?? data;
  return normalizeSessionFromApi(s);
}
