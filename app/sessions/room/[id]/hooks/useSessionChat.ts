// app/sessions/room/[id]/hooks/useSessionChat.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SessionChatMsg } from "../../../api/sessionsApi";
import {
    getSessionTyping,
    listSessionChat,
    sendSessionChat,
    setSessionTyping,
} from "../../../api/sessionsApi";

export type RoomChatItem = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

async function getToken() {
  return (await AsyncStorage.getItem("token")) || null;
}

function mapMsg(m: SessionChatMsg): RoomChatItem {
  return {
    id: String(m._id),
    senderId: String(m.senderId),
    text: String(m.text || ""),
    createdAt: String(m.createdAt || new Date().toISOString()),
  };
}

export function useSessionChat(sessionId: string, meId: string) {
  const [items, setItems] = useState<RoomChatItem[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [errorChat, setErrorChat] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [peerTyping, setPeerTyping] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(
    async (silent?: boolean) => {
      if (!sessionId) return;

      try {
        setErrorChat(null);
        if (!silent) setLoadingChat(true);

        const tk = tokenRef.current || (await getToken());
        tokenRef.current = tk;
        if (!tk) {
          setItems([]);
          setErrorChat("Not logged in");
          return;
        }

        const msgs = await listSessionChat(tk, sessionId);
        const mapped = msgs.map((m: SessionChatMsg) => mapMsg(m));

        // sort newest last for UI, we'll render inverted in component
        mapped.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setItems(mapped);
      } catch (e: any) {
        setErrorChat(e?.message || "Failed to load chat");
      } finally {
        if (!silent) setLoadingChat(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void refresh(false);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => void refresh(true), 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [refresh]);

  // typing poll (requirement #10)
  useEffect(() => {
    if (!sessionId) return;

    const run = async () => {
      const tk = tokenRef.current || (await getToken());
      tokenRef.current = tk;
      if (!tk) return;

      try {
        const res = await getSessionTyping(tk, sessionId);
        const ids = Array.isArray(res?.typingUserIds) ? res.typingUserIds : [];
const someoneElseTyping = ids.some((id: string) => String(id) !== String(meId));
        setPeerTyping(someoneElseTyping);
      } catch {
        // ignore typing failures to avoid noise
      }
    };

    void run();

    if (typingPollRef.current) clearInterval(typingPollRef.current);
    typingPollRef.current = setInterval(() => void run(), 2500);

    return () => {
      if (typingPollRef.current) clearInterval(typingPollRef.current);
      typingPollRef.current = null;
    };
  }, [meId, sessionId]);

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (!sessionId) return;

    const tk = tokenRef.current || (await getToken());
    tokenRef.current = tk;
    if (!tk) {
      setErrorChat("Not logged in");
      return;
    }

    const optimistic: RoomChatItem = {
      id: `optimistic-${Math.random().toString(16).slice(2)}`,
      senderId: meId || "me",
      text: t,
      createdAt: new Date().toISOString(),
    };

    setSending(true);
    setText("");
    setItems((prev) => [...prev, optimistic]);

    try {
      const real = await sendSessionChat(tk, sessionId, t);
      const mapped = mapMsg(real);

      setItems((prev) => {
        const without = prev.filter((x) => x.id !== optimistic.id);
        return [...without, mapped].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      // stop typing after send
      try {
        await setSessionTyping(tk, sessionId, false);
      } catch {}
    } catch (e: any) {
      setItems((prev) => prev.filter((x) => x.id !== optimistic.id));
      setText(t);
      setErrorChat(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }, [meId, sending, sessionId, text]);

  // send typing with debounce while user types (requirement #10)
  useEffect(() => {
    if (!sessionId) return;

    const run = async () => {
      const tk = tokenRef.current || (await getToken());
      tokenRef.current = tk;
      if (!tk) return;

      try {
        await setSessionTyping(tk, sessionId, text.trim().length > 0);
      } catch {
        // ignore
      }
    };

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => void run(), 350);

    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    };
  }, [sessionId, text]);

  const canSend = useMemo(() => text.trim().length > 0 && !sending, [sending, text]);

  return {
    items,
    loadingChat,
    errorChat,

    text,
    setText,
    sending,
    canSend,

    peerTyping,

    refresh,
    send,
  };
}
