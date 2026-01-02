// lib/chat/api.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../api";

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string; // ISO
};

export type PeerPublic = {
  id: string;
  fullName: string;
  points: number;
  xp: number;
  streak: number;
  avgRating: number;
  ratingCount: number;
};

export type ChatInboxItem = {
  id: string; // conversationId
  peer: PeerPublic | null;
  lastMessageText: string;
  lastMessageAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  unreadCount: number;
};

async function handleResponse(res: Response) {
  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data && (data as any).error) ||
      (data && (data as any).message) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${res.status}`;

    throw new Error(message);
  }

  return data;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * GET /api/chat/inbox
 * returns: ChatInboxItem[]
 */
export async function getChatInbox(token: string): Promise<ChatInboxItem[]> {
  const res = await fetch(`${API_URL}/api/chat/inbox`, {
    method: "GET",
    headers: {
      ...authHeader(token),
    },
  });


  const data = await handleResponse(res);
  return Array.isArray(data?.items) ? (data.items as ChatInboxItem[]) : [];
}
// ---- inbox cache (fast boot) ----
const INBOX_CACHE_KEY = "chat_inbox_cache_v1";

export async function getInboxCache(): Promise<ChatInboxItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(INBOX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatInboxItem[]) : null;
  } catch {
    return null;
  }
}

export async function setInboxCache(items: ChatInboxItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INBOX_CACHE_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * POST /api/chat/conversation
 * body: { peerId }
 * returns: { conversationId: string }
 */
export async function getOrCreateConversation(
  token: string,
  peerId: string
): Promise<string> {
  const res = await fetch(`${API_URL}/api/chat/conversation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify({ peerId }),
  });

  const data = await handleResponse(res);

  const conversationId = String(data?.conversationId || "").trim();
  if (!conversationId) throw new Error("Invalid conversationId");
  return conversationId;
}

/**
 * GET /api/chat/:conversationId/messages?limit=50&before=ISO
 * returns: { items: ChatMessage[] }
 */
export async function getConversationMessages(
  token: string,
  conversationId: string,
  opts?: { limit?: number; before?: string }
): Promise<{ items: ChatMessage[] }> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.before) params.set("before", String(opts.before));

  const q = params.toString();
  const url = `${API_URL}/api/chat/${encodeURIComponent(
    conversationId
  )}/messages${q ? `?${q}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...authHeader(token),
    },
  });

  const data = await handleResponse(res);

  return {
    items: Array.isArray(data?.items) ? (data.items as ChatMessage[]) : [],
  };
}

/**
 * POST /api/chat/:conversationId/messages
 * body: { text }
 * returns: { message: ChatMessage }
 */
export async function sendMessageRest(
  token: string,
  conversationId: string,
  text: string
): Promise<ChatMessage> {
  const res = await fetch(
    `${API_URL}/api/chat/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(token),
      },
      body: JSON.stringify({ text }),
    }
  );

  const data = await handleResponse(res);

  const msgObj = data?.message;
  if (!msgObj?.id) throw new Error("Invalid message payload");
  return msgObj as ChatMessage;
}
