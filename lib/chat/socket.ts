import { io, Socket } from "socket.io-client";
import { API_URL } from "../api";

export type RealtimeMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
};

type ConnStatus = "connected" | "reconnecting" | "disconnected";

let socket: Socket | null = null;
let currentToken: string | null = null;

// ✅ keep last joined room so we can re-join on reconnect safely
let lastJoin: { conversationId: string; peerId: string } | null = null;

// ✅ prevent duplicate global connection listeners
let connListenersBound = false;

// ✅ presence watch set (so we can re-watch on reconnect)
const watchedPresence = new Set<string>();

function normalizeCreatedAt(v: any): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function ensureConnected(token: string) {
  currentToken = token;

  if (socket) {
    socket.auth = token ? { token } : {};
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(API_URL, {
    transports: ["websocket"],
    auth: token ? { token } : {},
    autoConnect: true,
    reconnection: true,
  });

  return socket;
}

export function connectChatSocket(token: string) {
  const s = ensureConnected(token);

  // ✅ bind only once per socket instance
  if (!connListenersBound) {
    connListenersBound = true;

    s.on("connect", () => {
      // rejoin last room
      if (lastJoin?.conversationId) {
        s.emit("conversation:join", {
          conversationId: lastJoin.conversationId,
          peerId: lastJoin.peerId || "",
        });
      }

      // re-watch presence users
      if (watchedPresence.size) {
        for (const uid of watchedPresence) {
          s.emit("presence:watch", { userId: uid });
        }
      }
    });
  }

  return s;
}

export function disconnectChatSocket() {
  try {
    socket?.disconnect();
  } finally {
    socket = null;
    currentToken = null;
    lastJoin = null;
    connListenersBound = false;
    watchedPresence.clear();
  }
}

export function joinConversationRoom(conversationId: string, peerId?: string) {
  const s = socket;
  if (!s) return;

  const cid = String(conversationId || "").trim();
  const pid = String(peerId || "").trim();
  if (!cid) return;

  lastJoin = { conversationId: cid, peerId: pid };
  s.emit("conversation:join", { conversationId: cid, peerId: pid || "" });
}

export function markConversationRead(conversationId: string) {
  const s = socket;
  if (!s) return Promise.resolve();
  const cid = String(conversationId || "").trim();
  if (!cid) return Promise.resolve();

  return new Promise<void>((resolve) => {
    s.emit("conversation:read", { conversationId: cid });
    resolve();
  });
}

export function emitTyping(conversationId: string, isTyping: boolean) {
  const s = socket;
  if (!s) return;
  const cid = String(conversationId || "").trim();
  if (!cid) return;
  s.emit("typing", { conversationId: cid, isTyping: !!isTyping });
}

export function onNewMessage(handler: (m: RealtimeMessage) => void) {
  const s = socket;
  if (!s) return () => {};

  const wrapped = (payload: any) => {
    const msg: RealtimeMessage = {
      id: String(payload?.id || payload?._id || ""),
      conversationId: String(payload?.conversationId || ""),
      senderId: String(payload?.senderId || ""),
      text: String(payload?.text || ""),
      createdAt: normalizeCreatedAt(payload?.createdAt),
    };
    if (!msg.id || !msg.conversationId) return;
    handler(msg);
  };

  s.on("message:new", wrapped);
  return () => s.off("message:new", wrapped);
}

export function onPeerTyping(
  handler: (p: { conversationId: string; userId: string; isTyping: boolean }) => void
) {
  const s = socket;
  if (!s) return () => {};

  const wrapped = (payload: any) => {
    handler({
      conversationId: String(payload?.conversationId || ""),
      userId: String(payload?.userId || ""),
      isTyping: !!payload?.isTyping,
    });
  };

  s.on("typing", wrapped);
  return () => s.off("typing", wrapped);
}

export function onPresenceUpdate(
  handler: (p: { userId: string; online: boolean; lastSeen: string | null }) => void
) {
  const s = socket;
  if (!s) return () => {};

  const wrapped = (payload: any) => {
    handler({
      userId: String(payload?.userId || ""),
      online: !!payload?.online,
      lastSeen: payload?.lastSeen ? String(payload.lastSeen) : null,
    });
  };

  s.on("presence:update", wrapped);
  return () => s.off("presence:update", wrapped);
}

// ✅ NEW: Read receipts (Seen)
export function onReadReceipt(
  handler: (p: { conversationId: string; readerId: string; readAt?: string }) => void
) {
  const s = socket;
  if (!s) return () => {};

  const wrapped = (payload: any) => {
    handler({
      conversationId: String(payload?.conversationId || ""),
      readerId: String(payload?.readerId || ""),
      readAt: payload?.readAt ? String(payload.readAt) : undefined,
    });
  };

  s.on("read:receipt", wrapped);
  return () => s.off("read:receipt", wrapped);
}

// ✅ watch/unwatch presence
export function watchPresence(userId: string) {
  const s = socket;
  if (!s) return;
  const uid = String(userId || "").trim();
  if (!uid) return;
  watchedPresence.add(uid);
  s.emit("presence:watch", { userId: uid });
}

export function unwatchPresence(userId: string) {
  const s = socket;
  const uid = String(userId || "").trim();
  if (!uid) return;
  watchedPresence.delete(uid);
  if (!s) return;
  s.emit("presence:unwatch", { userId: uid });
}

// ✅ snapshot request (ack)
export function getPresenceSnapshot(
  userId: string
): Promise<{ userId: string; online: boolean; lastSeen: string | null } | null> {
  return new Promise((resolve) => {
    const s = socket;
    const uid = String(userId || "").trim();
    if (!s || !uid) return resolve(null);

    s.emit("presence:get", { userId: uid }, (resp: any) => {
      if (!resp) return resolve(null);
      resolve({
        userId: String(resp?.userId || uid),
        online: !!resp?.online,
        lastSeen: resp?.lastSeen ? String(resp.lastSeen) : null,
      });
    });
  });
}

export function onConnectionStatus(handler: (s: ConnStatus) => void) {
  const s = socket;
  if (!s) return () => {};

  const onConnect = () => handler("connected");
  const onDisconnect = () => handler("disconnected");
  const onReconnectAttempt = () => handler("reconnecting");
  const onConnectError = () => handler("reconnecting");

  s.on("connect", onConnect);
  s.on("disconnect", onDisconnect);
  s.io.on("reconnect_attempt", onReconnectAttempt);
  s.on("connect_error", onConnectError);

  handler(s.connected ? "connected" : "disconnected");

  return () => {
    s.off("connect", onConnect);
    s.off("disconnect", onDisconnect);
    s.off("connect_error", onConnectError);
    s.io.off("reconnect_attempt", onReconnectAttempt);
  };
}

export function sendRealtimeMessage(
  conversationId: string,
  text: string
): Promise<{ ok: boolean; message?: RealtimeMessage; error?: string }> {
  return new Promise((resolve) => {
    const s = socket;
    if (!s) return resolve({ ok: false, error: "Socket not connected" });

    const cid = String(conversationId || "").trim();
    const t = String(text || "").trim();
    if (!cid || !t) return resolve({ ok: false, error: "Missing data" });

    s.emit(
      "message:send",
      { conversationId: cid, text: t },
      (resp: any = { ok: false, error: "No response" }) => {
        if (!resp?.ok)
          return resolve({
            ok: false,
            error: String(resp?.error || "Failed"),
          });

        const payload = resp?.message || resp;
        const msg: RealtimeMessage = {
          id: String(payload?.id || payload?._id || "") || `${Date.now()}`,
          conversationId: String(payload?.conversationId || cid),
          senderId: String(payload?.senderId || ""),
          text: String(payload?.text || t),
          createdAt: normalizeCreatedAt(payload?.createdAt),
        };

        return resolve({ ok: true, message: msg });
      }
    );
  });
}
