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
// reference to avoid 'assigned but never used' linter warnings
void currentToken;

// ✅ keep last joined room so we can re-join on reconnect safely
let lastJoin: { conversationId: string; peerId: string } | null = null;

// ✅ prevent duplicate global connection listeners
let connListenersBound = false;

// store offers that arrive before a component registers a handler
export const pendingOffers = new Map<string, any>();
let offerListenerBound = false;

// ✅ presence watch set (so we can re-watch on reconnect)
const watchedPresence = new Set<string>();

// track last call-start timestamps per conversation to avoid
// accidental immediate call-end emissions caused by UI races
const lastCallStartedAt = new Map<string, number>();

function normalizeCreatedAt(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String((v as any) || ""));
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

  // bind a lightweight global offer listener so we can capture offers
  // that arrive before UI registers handlers (store into pendingOffers)
  if (!offerListenerBound) {
    offerListenerBound = true;
    s.on("webrtc:offer", (payload: unknown) => {
      try {
        const p = payload as any;
        const from = String(p?.fromUserId || "").trim();
        if (!from) return;
        pendingOffers.set(from, p?.sdp);
      } catch {}
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
  const wrapped = (payload: unknown) => {
    const p = payload as Record<string, unknown>;
    const msg: RealtimeMessage = {
      id: String((p as any)?.id || (p as any)?._id || ""),
      conversationId: String((p as any)?.conversationId || ""),
      senderId: String((p as any)?.senderId || ""),
      text: String((p as any)?.text || ""),
      createdAt: normalizeCreatedAt((p as any)?.createdAt),
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
  const wrapped = (payload: unknown) => {
    const p = payload as Record<string, unknown>;
    handler({
      conversationId: String((p as any)?.conversationId || ""),
      userId: String((p as any)?.userId || ""),
      isTyping: !!(p as any)?.isTyping,
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
  const wrapped = (payload: unknown) => {
    const p = payload as Record<string, unknown>;
    handler({
      userId: String((p as any)?.userId || ""),
      online: !!(p as any)?.online,
      lastSeen: (p as any)?.lastSeen ? String((p as any).lastSeen) : null,
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
  const wrapped = (payload: unknown) => {
    const p = payload as Record<string, unknown>;
    handler({
      conversationId: String((p as any)?.conversationId || ""),
      readerId: String((p as any)?.readerId || ""),
      readAt: (p as any)?.readAt ? String((p as any).readAt) : undefined,
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
      (resp: unknown = { ok: false, error: "No response" } as unknown) => {
        const r = resp as Record<string, unknown> | undefined;
        if (!r || !(r as any)?.ok)
          return resolve({
            ok: false,
            error: String((r as any)?.error || "Failed"),
          });

        const payload = (r as any)?.message || r;
        const msg: RealtimeMessage = {
          id: String((payload as any)?.id || (payload as any)?._id || "") || `${Date.now()}`,
          conversationId: String((payload as any)?.conversationId || cid),
          senderId: String((payload as any)?.senderId || ""),
          text: String((payload as any)?.text || t),
          createdAt: normalizeCreatedAt((payload as any)?.createdAt),
        };

        return resolve({ ok: true, message: msg });
      }
    );
  });
}

// ----- WebRTC signaling helpers (relay through socket.io) -----
export function sendOffer(toUserId: string, sdp: any) {
  const s = socket;
  if (!s) return;
  s.emit("webrtc:offer", { toUserId: String(toUserId || "").trim(), sdp });
}

// ringing + reject helpers
export function sendRing(toUserId: string, conversationId?: string) {
  const s = socket;
  if (!s) return;
  s.emit("webrtc:ring", { toUserId: String(toUserId || "").trim(), conversationId: String(conversationId || "").trim() });
}

export function sendReject(toUserId: string) {
  const s = socket;
  if (!s) return;
  // debug trace to find unexpected reject origins
  try {
    console.log('[webrtc][emit] sendReject', { toUserId });
    console.trace('[webrtc][emit] sendReject stack');
  } catch {}
  s.emit("webrtc:reject", { toUserId: String(toUserId || "").trim() });
}

export function sendAnswer(toUserId: string, sdp: any) {
  const s = socket;
  if (!s) return;
  s.emit("webrtc:answer", { toUserId: String(toUserId || "").trim(), sdp });
}

export function sendIceCandidate(toUserId: string, candidate: any) {
  const s = socket;
  if (!s) return;
  s.emit("webrtc:ice-candidate", { toUserId: String(toUserId || "").trim(), candidate });
}

// Call lifecycle helpers
export function sendCallStarted(conversationId: string, toUserId?: string) {
  const s = socket;
  if (!s) return;
  try {
    console.log('[webrtc][emit] sendCallStarted', { conversationId, toUserId });
    console.trace('[webrtc][emit] sendCallStarted stack');
  } catch {}
  try {
    const key = String(conversationId || "").trim();
    if (key) lastCallStartedAt.set(key, Date.now());
  } catch {}
  s.emit("webrtc:call-start", { conversationId: String(conversationId || "").trim(), toUserId: String(toUserId || "").trim() });
}

export function sendCallEnded(conversationId: string, toUserId?: string, durationSec?: number) {
  const s = socket;
  if (!s) return;
  try {
    const key = String(conversationId || "").trim();
    const now = Date.now();
    const lastStart = key ? lastCallStartedAt.get(key) || 0 : 0;
    // If a call-start was emitted very recently (race), and call duration is tiny,
    // skip emitting this call-end to avoid immediate teardown caused by UI races.
    if (lastStart && now - lastStart < 2000 && (!durationSec || durationSec < 2)) {
      console.warn('[webrtc][emit] suppressing sendCallEnded due to recent call-start', { conversationId, toUserId, durationSec, dt: now - lastStart });
      console.trace('[webrtc][emit] suppressed sendCallEnded stack');
      return;
    }

    console.log('[webrtc][emit] sendCallEnded', { conversationId, toUserId, durationSec });
    console.trace('[webrtc][emit] sendCallEnded stack');
  } catch {}
  s.emit("webrtc:call-end", { conversationId: String(conversationId || "").trim(), toUserId: String(toUserId || "").trim(), durationSec });
}

export function onCallStarted(handler: (p: { fromUserId: string; conversationId: string }) => void) {
  const s = socket;
  if (!s) return () => {};
  const wrapped = (payload: unknown) => {
    const p = payload as any;
    handler({ fromUserId: String(p?.fromUserId || ""), conversationId: String(p?.conversationId || "") });
  };
  s.on("webrtc:call-start", wrapped);
  return () => s.off("webrtc:call-start", wrapped);
}

export function onCallEnded(handler: (p: { fromUserId: string; conversationId: string; durationSec?: number }) => void) {
  const s = socket;
  if (!s) return () => {};
  const wrapped = (payload: unknown) => {
    const p = payload as any;
    handler({ fromUserId: String(p?.fromUserId || ""), conversationId: String(p?.conversationId || ""), durationSec: p?.durationSec });
  };
  s.on("webrtc:call-end", wrapped);
  return () => s.off("webrtc:call-end", wrapped);
}

export function onOffer(handler: (p: { fromUserId: string; sdp: any }) => void) {
  const s = socket;
  if (!s) return () => {};
  const wrapped = (payload: unknown) => {
    const p = payload as any;
    handler({ fromUserId: String(p?.fromUserId || ""), sdp: p?.sdp });
  };
  s.on("webrtc:offer", wrapped);
  // if offers arrived earlier, invoke the handler now for them and clear buffer
  try {
    for (const [from, sdp] of pendingOffers.entries()) {
      try {
        handler({ fromUserId: String(from), sdp });
      } catch {}
      // consume the buffered offer so subsequent handlers don't recreate peers
      try {
        pendingOffers.delete(from);
      } catch {}
    }
  } catch {}
  return () => s.off("webrtc:offer", wrapped);
}

export function onRing(handler: (p: { fromUserId: string; toUserId?: string; conversationId?: string }) => void) {
  const s = socket;
  if (!s) return () => {};
  const wrapped = (payload: unknown) => {
    const p = payload as any;
    handler({ fromUserId: String(p?.fromUserId || ""), toUserId: p?.toUserId ? String(p?.toUserId) : undefined, conversationId: p?.conversationId ? String(p?.conversationId) : undefined });
  };
  s.on("webrtc:ring", wrapped);
  return () => s.off("webrtc:ring", wrapped);
}

export function onReject(handler: (p: { fromUserId: string }) => void) {
  const s = socket;
  if (!s) return () => {};
  const wrapped = (payload: unknown) => {
    const p = payload as any;
    handler({ fromUserId: String(p?.fromUserId || "") });
  };
  s.on("webrtc:reject", wrapped);
  return () => s.off("webrtc:reject", wrapped);
}

export function onAnswer(handler: (p: { fromUserId: string; sdp: any }) => void) {
  const s = socket;
  if (!s) return () => {};
  const wrapped = (payload: unknown) => {
    const p = payload as any;
    handler({ fromUserId: String(p?.fromUserId || ""), sdp: p?.sdp });
  };
  s.on("webrtc:answer", wrapped);
  return () => s.off("webrtc:answer", wrapped);
}

export function onIceCandidate(handler: (p: { fromUserId: string; candidate: any }) => void) {
  const s = socket;
  if (!s) return () => {};
  const wrapped = (payload: unknown) => {
    const p = payload as any;
    handler({ fromUserId: String(p?.fromUserId || ""), candidate: p?.candidate });
  };
  s.on("webrtc:ice-candidate", wrapped);
  return () => s.off("webrtc:ice-candidate", wrapped);
}
