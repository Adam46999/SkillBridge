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

export type SessionChatMsg = {
  _id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export type SessionFileDTO = {
  _id: string;
  uploaderId: string;
  name: string;
  url: string; // غالباً /uploads/...
  createdAt: string;
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

  // ✅ Session Room additions (optional حتى ما نكسر القديم)
  chat?: SessionChatMsg[];
  files?: SessionFileDTO[];
  zoomJoinUrl?: string;
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
  const r = await apiFetch<{ session: SessionDTO }>("/api/sessions", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

// ✅ Smart Delete
export async function deleteSessionSmart(
  token: string,
  sessionId: string
): Promise<{ ok: boolean; action: string }> {
  return apiFetch(`/api/sessions/${sessionId}/delete`, token, { method: "POST" });
}

export async function getSessionById(
  token: string,
  sessionId: string
): Promise<SessionDTO> {
  const r = await apiFetch<{ session: SessionDTO }>(
    `/api/sessions/${sessionId}`,
    token
  );
  return r.session;
}

// ---------------- Session Room: CHAT ----------------
export async function listSessionChat(
  token: string,
  sessionId: string
): Promise<SessionChatMsg[]> {
  const r = await apiFetch<{ messages: SessionChatMsg[] }>(
    `/api/sessions/${sessionId}/chat`,
    token
  );
  return r.messages || [];
}

export async function sendSessionChat(
  token: string,
  sessionId: string,
  text: string
): Promise<SessionChatMsg> {
  const r = await apiFetch<{ message: SessionChatMsg }>(
    `/api/sessions/${sessionId}/chat`,
    token,
    { method: "POST", body: JSON.stringify({ text }) }
  );
  return r.message;
}

// ---------------- Session Room: FILES ----------------
export async function listSessionFiles(
  token: string,
  sessionId: string
): Promise<SessionFileDTO[]> {
  const r = await apiFetch<{ files: SessionFileDTO[] }>(
    `/api/sessions/${sessionId}/files`,
    token
  );
  return r.files || [];
}

// multipart upload
export async function uploadSessionFile(
  token: string,
  sessionId: string,
  file: { uri: string; name: string; mimeType: string }
): Promise<SessionFileDTO> {
  const form = new FormData();
  // @ts-ignore
  form.append("file", { uri: file.uri, name: file.name, type: file.mimeType });

  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // مهم: لا تضع Content-Type
    } as any,
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error || "Upload failed";
    throw new Error(msg);
  }
  return (json as any).file as SessionFileDTO;
}
// ---------------- Session Room: ZOOM ----------------
export async function ensureZoomMeeting(
  token: string,
  sessionId: string
): Promise<{ zoomJoinUrl: string }> {
  // إذا عندك endpoint ثاني للزوم غيّر المسار هون فقط
  return apiFetch<{ zoomJoinUrl: string }>(`/api/sessions/${sessionId}/zoom`, token, {
    method: "POST",
  });
}

// ---------------- Session Room: TYPING ----------------
export async function setSessionTyping(
  token: string,
  sessionId: string,
  isTyping: boolean
): Promise<{ ok: boolean }> {
  // إذا عندك endpoint ثاني للتايبينغ غيّر المسار هون فقط
  return apiFetch<{ ok: boolean }>(`/api/sessions/${sessionId}/chat/typing`, token, {
    method: "POST",
    body: JSON.stringify({ isTyping }),
  });
}

export async function getSessionTyping(
  token: string,
  sessionId: string
): Promise<{ typingUserIds: string[] }> {
  // إذا ما عندك backend للتايبينغ هسا، عادي — بس لازم يرجّع typingUserIds لاحقاً
  return apiFetch<{ typingUserIds: string[] }>(`/api/sessions/${sessionId}/chat/typing`, token);
}
