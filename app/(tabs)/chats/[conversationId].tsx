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
  sendMessageRest,
  type ChatMessage,
} from "../../../lib/chat/api";

import {
  connectChatSocket,
  disconnectChatSocket,
  joinConversationRoom,
  markConversationRead,
  onConnectionStatus,
  onNewMessage,
  onPeerTyping,
  onPresenceUpdate,
  sendRealtimeMessage,
  type RealtimeMessage,
} from "../../../lib/chat/socket";

import ChatHeader from "./(components)/ChatHeader";
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

  const boot = useCallback(async () => {
    if (!convId) {
      router.back();
      return () => {};
    }

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      router.replace("/(auth)/login" as any);
      return () => {};
    }

    setLoading(true);

    const cleanupFns: ((() => void) | undefined)[] = [];

    try {
      const me = await getMe(token);
      if (!mountedRef.current) return () => {};

      const myId = String(me?.user?._id || "");
      setMeId(myId);

      // ✅ API returns { items: ChatMessage[] }
      const first = await getConversationMessages(token, convId, { limit: 50 });
      if (!mountedRef.current) return () => {};

      const firstArr = Array.isArray(first?.items) ? first.items : [];
      setItems(firstArr);
      setHasMore(firstArr.length >= 50);

      // ✅ connect socket (socket.ts handles re-join on reconnect)
      connectChatSocket(token);

      // ✅ join once now (and will re-join on reconnect from socket.ts)
      joinConversationRoom(convId, peerId);

      cleanupFns.push(onConnectionStatus(setConn));

      cleanupFns.push(
        onNewMessage((m) => {
          if (String(m.conversationId) !== convId) return;

          const cm = toChatMessage(m);
          setItems((prev) => {
            if (prev.some((x) => x.id === cm.id)) return prev;
            return [...prev, cm];
          });

          void markConversationRead(convId);
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

      void markConversationRead(convId);

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
  }, [convId, peerId, router]);

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

      // ✅ disconnect ONCE (no double disconnect / no looping)
      disconnectChatSocket();
    };
  }, [boot]);

  const loadOlder = useCallback(async () => {
    if (paging || !hasMore || !oldestIso) return;

    const token = await AsyncStorage.getItem("token");
    if (!token) return;

    setPaging(true);
    try {
      // ✅ API returns { items: ChatMessage[] }
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
      router.replace("/(auth)/login" as any);
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
      />

      <MessagesList
        items={items}
        meId={meId}
        paging={paging}
        hasMore={hasMore}
        onLoadOlder={loadOlder}
      />

      <ChatInput
        value={text}
        sending={sending}
        onChange={setText}
        onSend={send}
      />
    </KeyboardAvoidingView>
  );
}
