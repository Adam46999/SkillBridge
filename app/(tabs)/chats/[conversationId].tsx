import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";

import { getMe } from "../../../lib/api";
import {
  getConversationMessages,
  markConversationReadRest,
  sendMessageRest,
  type ChatMessage,
} from "../../../lib/chat/api";

import {
  connectChatSocket,
  disconnectChatSocket,
  getPresenceSnapshot,
  joinConversationRoom,
  markConversationRead,
  onConnectionStatus,
  onNewMessage,
  onPeerTyping,
  onPresenceUpdate,
  onReadReceipt,
  onCallStarted,
  onCallEnded,
  onRing,
  onReject,
  sendRealtimeMessage,
  unwatchPresence,
  watchPresence,
  type RealtimeMessage,
} from "../../../lib/chat/socket";

import ChatHeader from "./(components)/ChatHeader";
import CallControls from "./CallControls";
import ChatInput from "./(components)/ChatInput";
import MessagesList from "./(components)/MessagesList";

function toChatMessage(m: RealtimeMessage): ChatMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    createdAt:
      typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
  };
}

function toTime(s: string) {
  const d = new Date(s);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    conversationId?: string;
    peerName?: string;
    peerId?: string;
    initialRingingFrom?: string;
  }>();

  const convId = String(params.conversationId || "").trim();
  const peerName = String(params.peerName || params.peerId || "Chat");
  const peerId = String(params.peerId || "").trim();

  const mountedRef = useRef(true);

  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [conn, setConn] = useState<
    "connected" | "reconnecting" | "disconnected"
  >("disconnected");

  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeenIso, setPeerLastSeenIso] = useState<string | null>(null);

  // ✅ for Seen status
  const [peerReadAtIso, setPeerReadAtIso] = useState<string | null>(null);

  const [paging, setPaging] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const sorted = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
  }, [items]);

  const oldestIso = useMemo(() => {
    if (!sorted.length) return null;
    return sorted[0]?.createdAt || null;
  }, [sorted]);

  const safeMarkRead = useCallback(
    async (token: string) => {
      if (!convId) return;

      // socket event (fast)
      try {
        markConversationRead(convId);
      } catch {}

      // REST (source of truth)
      try {
        await markConversationReadRest(token, convId);
      } catch {}
    },
    [convId]
  );

  const boot = useCallback(async () => {
    if (!convId) {
      router.back();
      return () => {};
    }

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      router.replace("/(auth)/login");
      return () => {};
    }

    setLoading(true);

    const cleanupFns: ((() => void) | undefined)[] = [];

    try {
      // if layout passed an initial ringing param, pre-open call UI
        try {
          const initFrom = String(params.initialRingingFrom || "").trim();
          if (initFrom && peerId && String(initFrom) === String(peerId)) {
            setCallPeerIdState(initFrom);
            setInitialRingingFrom(initFrom);
            setShowCallControls(true);
          }
        } catch {}

      const me = await getMe(token);
      if (!mountedRef.current) return () => {};

      const myId = String(me?.user?._id || "");
      setMeId(myId);

      const first = await getConversationMessages(token, convId, { limit: 50 });
      if (!mountedRef.current) return () => {};

      const firstArr = Array.isArray(first?.items) ? first.items : [];
      setItems(firstArr);
      setHasMore(firstArr.length >= 50);

      connectChatSocket(token);
      joinConversationRoom(convId, peerId);

      cleanupFns.push(onConnectionStatus(setConn));

      // ✅ Presence: snapshot + watch realtime
      if (peerId) {
        watchPresence(peerId);

        void (async () => {
          const snap = await getPresenceSnapshot(peerId);
          if (!mountedRef.current) return;
          if (snap && String(snap.userId) === String(peerId)) {
            setPeerOnline(!!snap.online);
            setPeerLastSeenIso(snap.lastSeen ? String(snap.lastSeen) : null);
          }
        })();
      }

      cleanupFns.push(
        onNewMessage((m) => {
          if (String(m.conversationId) !== convId) return;

          const cm = toChatMessage(m);
          setItems((prev) => {
            if (prev.some((x) => x.id === cm.id)) return prev;
            return [...prev, cm];
          });

          // mark read only if message is from peer (not me)
          if (String(cm.senderId) !== String(myId)) {
            void safeMarkRead(token);
          }
        })
      );

      cleanupFns.push(
        onPeerTyping((p) => {
          if (String(p.conversationId) !== convId) return;
          if (String(p.userId) === myId) return;

          setPeerTyping(!!p.isTyping);

          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          if (p.isTyping) {
            typingTimerRef.current = setTimeout(() => {
              setPeerTyping(false);
            }, 1400);
          }
        })
      );

      cleanupFns.push(
        onPresenceUpdate((p) => {
          if (!peerId) return;
          if (String(p.userId) !== String(peerId)) return;

          setPeerOnline(!!p.online);
          setPeerLastSeenIso(p.lastSeen ? String(p.lastSeen) : null);
        })
      );

      // ✅ Read receipts
      cleanupFns.push(
        onReadReceipt((p) => {
          if (String(p.conversationId) !== convId) return;

          // receipt from peer means: peer has read my messages
          if (peerId && String(p.readerId) === String(peerId)) {
            setPeerReadAtIso(
              p.readAt ? String(p.readAt) : new Date().toISOString()
            );
          }
        })
      );

      // WebRTC: SDP offers will be handled by CallControls directly (avoid duplicate handlers)

      // also handle ring events (in case ring arrives before offer)
      try {
        const offR = onRing((p) => {
          const from = String(p.fromUserId || "").trim();
          if (!from) return;
          if (peerId && from !== String(peerId)) return;
          setCallPeerIdState(from);
          setInitialRingingFrom(from);
          setShowCallControls(true);
        });
        cleanupFns.push(offR);
      } catch {}

      // also react to call-start from server (in case it's emitted)
      try {
        const offStart = onCallStarted((p) => {
          const from = String(p.fromUserId || "").trim();
          if (!from) return;
          if (peerId && from !== String(peerId)) return;
          setCallPeerIdState(from);
          setShowCallControls(true);
        });
        cleanupFns.push(offStart);
      } catch {}

      // react to call-end to ensure UI closes on both sides
      try {
        const offEnd = onCallEnded((p) => {
          const from = String(p.fromUserId || "").trim();
          if (!from) return;
          if (peerId && from !== String(peerId)) return;
          setShowCallControls(false);
          setCallPeerIdState(null);
          setInitialRingingFrom(null);
        });
        cleanupFns.push(offEnd);
      } catch {}

      // handle remote reject (callee declined) to close caller UI
      try {
        const offRej = onReject((p) => {
          const from = String(p.fromUserId || "").trim();
          if (!from) return;
          if (peerId && from !== String(peerId)) return;
          // if caller sees reject from callee, close call UI
          setShowCallControls(false);
          setCallPeerIdState(null);
        });
        cleanupFns.push(offRej);
      } catch {}

      void safeMarkRead(token);

      return () => {
        cleanupFns.forEach((fn) => {
          try {
            fn?.();
          } catch {}
        });
      };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [convId, peerId, router, safeMarkRead, params.initialRingingFrom]);

  useEffect(() => {
    mountedRef.current = true;

    let cleanup: (() => void) | null = null;
    (async () => {
      cleanup = await boot();
    })();

    return () => {
      mountedRef.current = false;

      try {
        cleanup?.();
      } catch {}

      try {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      } catch {}

      try {
        if (peerId) unwatchPresence(peerId);
      } catch {}

      disconnectChatSocket();
    };
  }, [boot, peerId]);

  const loadOlder = useCallback(async () => {
    if (paging || !hasMore || !oldestIso) return;

    const token = await AsyncStorage.getItem("token");
    if (!token) return;

    setPaging(true);
    try {
      const older = await getConversationMessages(token, convId, {
        limit: 50,
        before: oldestIso,
      });

      const arr = Array.isArray(older?.items) ? older.items : [];
      setHasMore(arr.length >= 50);

      setItems((prev) => {
        const existing = new Set(prev.map((x) => x.id));
        const merged = [...arr.filter((x) => !existing.has(x.id)), ...prev];
        return merged;
      });
    } finally {
      if (mountedRef.current) setPaging(false);
    }
  }, [convId, hasMore, oldestIso, paging]);

  const send = useCallback(async () => {
    const clean = String(text || "").trim();
    if (!clean || !convId || sending) return;

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }

    setSending(true);
    try {
      const rt = await sendRealtimeMessage(convId, clean);

      if (rt.ok && rt.message) {
        const cm = toChatMessage(rt.message);
        setItems((prev) => {
          if (prev.some((x) => x.id === cm.id)) return prev;
          return [...prev, cm];
        });
        setText("");
        return;
      }

      const m = await sendMessageRest(token, convId, clean);
      setItems((prev) => [...prev, m]);
      setText("");
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  }, [convId, router, sending, text]);

  const openPeerProfile = useCallback(() => {
    if (!peerId) return;
    router.push(`/mentor/${peerId}`);
  }, [peerId, router]);

  const requestSessionFromChat = useCallback(() => {
    if (!peerId) return;
    router.push({
      pathname: "/sessions/request" as any,
      params: { mentorId: peerId, mentorName: peerName },
    });
  }, [peerId, peerName, router]);

  const [showCallControls, setShowCallControls] = useState(false);
  const [callPeerIdState, setCallPeerIdState] = useState<string | null>(null);
  const [initialRingingFrom, setInitialRingingFrom] = useState<string | null>(null);

  const startCall = useCallback(() => {
    setCallPeerIdState(peerId || null);
    setShowCallControls(true);
  }, [peerId]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#020617",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: "#94A3B8", fontWeight: "800" }}>
          Loading chat…
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ChatHeader
        title={peerName}
        onBack={() => router.back()}
        conn={conn}
        peerTyping={peerTyping}
        peerOnline={peerOnline}
        peerLastSeenIso={peerLastSeenIso}
        // ✅ new actions
        onPressTitle={openPeerProfile}
        onPressAvatar={openPeerProfile}
        onRequestSession={requestSessionFromChat}
        onStartCall={startCall}
      />

      <MessagesList
        items={items}
        meId={meId}
        paging={paging}
        hasMore={hasMore}
        onLoadOlder={loadOlder}
        // ✅ pass read timestamp for Seen UI
        peerReadAtIso={peerReadAtIso}
      />

      <ChatInput
        value={text}
        sending={sending}
        onChange={setText}
        onSend={send}
      />

      {showCallControls && (
        <View style={{ position: "absolute", bottom: 80, left: 12, right: 12 }}>
          <CallControls
            peerId={callPeerIdState ?? peerId}
            peerName={peerName}
            conversationId={convId}
            initialRingingFrom={initialRingingFrom ?? undefined}
            onClose={() => {
              setShowCallControls(false);
              setCallPeerIdState(null);
              setInitialRingingFrom(null);
            }}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

export const options = {
  title: "Conversation",
  headerTitle: "Conversation",
  headerShown: true,
};
