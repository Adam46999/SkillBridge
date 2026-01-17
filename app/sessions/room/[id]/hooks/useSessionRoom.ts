// app/sessions/room/[id]/hooks/useSessionRoom.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";

import { getMe } from "../../../../../lib/api";
import type { SessionDTO, SessionStatus } from "../../../api/sessionsApi";
import { ensureZoomMeeting, getSessionById, joinSession, updateSessionStatus } from "../../../api/sessionsApi";

const UI_RULES = {
  JOIN_EARLY_MIN: 5,
  JOIN_LATE_MIN: 180,
};

function toMs(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) ? t : null;
}
function minutesUntil(iso?: string | null) {
  const t = toMs(iso);
  if (!t) return null;
  return Math.floor((t - Date.now()) / 60000);
}
function secondsUntil(iso?: string | null) {
  const t = toMs(iso);
  if (!t) return null;
  return Math.floor((t - Date.now()) / 1000);
}

function canJoinNow(iso?: string | null) {
  const untilMin = minutesUntil(iso);
  if (untilMin === null) return { ok: false as const, reason: "Invalid time" };

  if (untilMin > 0 && untilMin <= UI_RULES.JOIN_EARLY_MIN) return { ok: true as const };
  if (untilMin <= 0) {
    const start = toMs(iso) || Date.now();
    const sinceMin = Math.floor((Date.now() - start) / 60000);
    if (sinceMin <= UI_RULES.JOIN_LATE_MIN) return { ok: true as const };
    return { ok: false as const, reason: "Join window expired" };
  }
  return { ok: false as const, reason: `Join opens ${UI_RULES.JOIN_EARLY_MIN} min before` };
}

async function getToken() {
  return (await AsyncStorage.getItem("token")) || null;
}

export function useSessionRoom(sessionId: string) {
  const [meId, setMeId] = useState<string>("");
  const [session, setSession] = useState<SessionDTO | null>(null);

  const [loadingSession, setLoadingSession] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(
    async (silent?: boolean) => {
      if (!sessionId) return;

      try {
        setError(null);
        if (!silent) setLoadingSession(true);

        const tk = tokenRef.current || (await getToken());
        tokenRef.current = tk;

        if (!tk) {
          setSession(null);
          setError("Not logged in");
          return;
        }

        const me = await getMe(tk);
        const myId = String((me as any)?._id || (me as any)?.id || "").trim();
        setMeId(myId);

        const s = await getSessionById(tk, sessionId);
        setSession(s);
      } catch (e: any) {
        setError(e?.message || "Failed to load session");
        setSession(null);
      } finally {
        if (!silent) setLoadingSession(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void refresh(false);

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setTick((x) => x + 1), 1000);

    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => void refresh(true), 8000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      tickRef.current = null;
      refreshTimerRef.current = null;
    };
  }, [refresh]);

  const isMentor = useMemo(() => {
    if (!session || !meId) return false;
    return String(session.mentorId) === String(meId);
  }, [session, meId]);

  const isLearner = useMemo(() => {
    if (!session || !meId) return false;
    return String(session.learnerId) === String(meId);
  }, [session, meId]);

  const joinGate = useMemo(() => {
    void tick;
    return canJoinNow(session?.scheduledAt);
  }, [session?.scheduledAt, tick]);

  const countdownSeconds = useMemo(() => {
    void tick;
    return secondsUntil(session?.scheduledAt);
  }, [session?.scheduledAt, tick]);

  const runStatus = useCallback(
    async (status: SessionStatus) => {
      const tk = tokenRef.current || (await getToken());
      tokenRef.current = tk;
      if (!tk) return Alert.alert("Not logged in", "Please login again.");

      try {
        setBusyAction(true);
        const updated = await updateSessionStatus(tk, sessionId, status);
        setSession(updated);
      } catch (e: any) {
        Alert.alert("Failed", e?.message || "Request failed");
      } finally {
        setBusyAction(false);
      }
    },
    [sessionId]
  );

  const cancel = useCallback(async () => {
    if (!session) return;
    if (session.status === "cancelled" || session.status === "completed") {
      return Alert.alert("Not allowed", "Session already finished.");
    }

    Alert.alert("Cancel session", "Are you sure you want to cancel?", [
      { text: "Back", style: "cancel" },
      { text: "Cancel", style: "destructive", onPress: () => void runStatus("cancelled") },
    ]);
  }, [runStatus, session]);

  const openZoom = useCallback(async () => {
    if (!session) return;

    if (session.status !== "accepted") {
      return Alert.alert("Not allowed", "Session must be accepted first.");
    }
    if (!joinGate.ok) {
      return Alert.alert("Join locked", joinGate.reason || "Join is not available yet.");
    }

    const tk = tokenRef.current || (await getToken());
    tokenRef.current = tk;
    if (!tk) return Alert.alert("Not logged in", "Please login again.");

    try {
      setBusyAction(true);

      // mark join on server (keeps your existing flow)
      const updated = await joinSession(tk, sessionId);
      setSession(updated);

      // ✅ Safe zoom url resolution:
      // 1) prefer updated.zoomJoinUrl
      // 2) else try ensureZoomMeeting
      // 3) else fallback to session.zoomJoinUrl if exists
      let zoomUrl = String(updated?.zoomJoinUrl || "").trim();
      if (!zoomUrl) {
        try {
          const ensured = await ensureZoomMeeting(tk, sessionId);
          zoomUrl = String((ensured as any)?.zoomJoinUrl || "").trim();
        } catch {}
      }
      if (!zoomUrl) {
        zoomUrl = String(session?.zoomJoinUrl || "").trim();
      }

      if (!zoomUrl) {
        Alert.alert("Missing Zoom link", "No Zoom link found for this session.");
        return;
      }

      const can = await Linking.canOpenURL(zoomUrl);
      if (!can) {
        Alert.alert("Cannot open", "Invalid Zoom link.");
        return;
      }
      await Linking.openURL(zoomUrl);
    } catch (e: any) {
      Alert.alert("Join failed", e?.message || "Failed to join session.");
    } finally {
      setBusyAction(false);
    }
  }, [joinGate.ok, joinGate.reason, session, sessionId]);

  return {
    meId,
    session,

    loadingSession,
    busyAction,
    error,

    isMentor,
    isLearner,

    joinGate,
    countdownSeconds,

    refresh,
    cancel,
    openZoom,
  };
}
