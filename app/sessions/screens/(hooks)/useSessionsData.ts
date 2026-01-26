import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getMe } from "../../../../lib/api";
import { listMySessions, type SessionDTO } from "../../api/sessionsApi";

export type Scope = "upcoming" | "past" | "all";

type LoadOpts = {
  silent?: boolean; // لا تغيّر loading الرئيسي
  listOnly?: boolean; // استخدم loadingList بدل loading
  force?: boolean; // تجاهل الكاش واعمل fetch مباشر
};

function cacheKey(scope: Scope, userId?: string | null) {
  // ✅ FIX: make cache per-user to avoid showing previous account sessions
  const uid = (userId || "anon").trim() || "anon";
  return `sessions_cache_v1:${uid}:${scope}`;
}

function safeJsonParse<T>(txt: string | null): T | null {
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function sortSessions(list: SessionDTO[]) {
  // أحدث سيشن (حسب scheduledAt) بالأعلى
  return list
    .slice()
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
}
function pickUserId(me: any): string | null {
  const candidates = [
    me?.id,
    me?._id,
    me?.user?.id,
    me?.user?._id,
    me?.data?.id,
    me?.data?._id,
    me?.profile?.id,
    me?.profile?._id,
    me?.userId,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  return candidates[0] || null;
}

function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    // base64url -> base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    const payload = JSON.parse(json);

    const id =
      payload?.id || payload?._id || payload?.userId || payload?.sub || null;

    const out = String(id || "").trim();
    return out || null;
  } catch {
    return null;
  }
}

export function useSessionsData(scope: Scope) {
  const router = useRouter();

  const mountedRef = useRef(true);
  const tokenRef = useRef<string | null>(null);
  const meIdRef = useRef<string | null>(null);
  const didMountRef = useRef(false);

  // لمنع race conditions
  const reqSeqRef = useRef(0);

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // نستخدمها لنعرف إذا عرضنا كاش بالفعل لهذا الـ scope
  const shownCacheForScopeRef = useRef<Record<string, boolean>>({});

  const ensureToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;

    const t = await AsyncStorage.getItem("token");
    console.log("[sessions] token =", t);

    tokenRef.current = t;

    if (mountedRef.current) setToken(t);

    return t;
  }, []);
const ensureMe = useCallback(async () => {
  if (meIdRef.current) return meIdRef.current;

  const t = await ensureToken();
  if (!t) return null;

  const me = await getMe(t);

  // ✅ 1) حاول من الـ response بأي شكل كان
  let id = pickUserId(me);

  // ✅ 2) fallback: طلّعها من التوكن
  if (!id) id = decodeJwtUserId(t);

  meIdRef.current = id;
  if (mountedRef.current) setCurrentUserId(id);

  return id;
}, [ensureToken]);


  const showCacheIfAvailable = useCallback(
    async (scopeToUse: Scope, userId?: string | null) => {
      const key = cacheKey(scopeToUse, userId);

      // لا نعيد عرض الكاش بنفس السكوب كل مرة
      if (shownCacheForScopeRef.current[key]) return;

      const cachedRaw = await AsyncStorage.getItem(key);
      const cached =
        safeJsonParse<{ ts: number; items: SessionDTO[] }>(cachedRaw);

      if (cached?.items?.length && mountedRef.current) {
        setSessions(sortSessions(cached.items));
      }

      shownCacheForScopeRef.current[key] = true;
    },
    []
  );

  const writeCache = useCallback(
    async (scopeToUse: Scope, userId: string | null, list: SessionDTO[]) => {
      const key = cacheKey(scopeToUse, userId);
      const payload = { ts: Date.now(), items: list };
      try {
        await AsyncStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // ignore
      }
    },
    []
  );

  const load = useCallback(
    async (opts?: LoadOpts) => {
      const seq = ++reqSeqRef.current;

      const silent = !!opts?.silent;
      const listOnly = !!opts?.listOnly;
      const force = !!opts?.force;

      if (!silent) {
        if (listOnly) setLoadingList(true);
        else setLoading(true);
      }
      setErrorText(null);

      try {
        const t = await ensureToken();
        if (!t) {
            // user not logged in -> go to login
            if (mountedRef.current) router.replace("/(auth)/login");
            return;
          }

        const meId = await ensureMe();

        // show cache quickly (unless force)
        if (!force) {
          await showCacheIfAvailable(scope, meId);
        }

const items = await listMySessions(t);
        const sorted = sortSessions(items);

        // ignore older requests
        if (reqSeqRef.current !== seq) return;

        if (mountedRef.current) {
          setSessions(sorted);
        }

        if (meId) {
          await writeCache(scope, meId, sorted);
        }
      } catch (e: any) {
        if (reqSeqRef.current !== seq) return;

        const msg = e?.message || "Failed to load sessions";
        if (mountedRef.current) setErrorText(msg);
      } finally {
        if (!silent) {
          if (listOnly) setLoadingList(false);
          else setLoading(false);
        }
        setRefreshing(false);
      }
    },
    [ensureMe, ensureToken, router, scope, showCacheIfAvailable, writeCache]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true, force: true });
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (didMountRef.current) {
      load({ listOnly: true });
      return;
    }
    didMountRef.current = true;
    load();
  }, [load]);

  const hasAny = useMemo(() => sessions.length > 0, [sessions.length]);

  return {
    token,
    currentUserId,
    sessions,
    loading,
    loadingList,
    refreshing,
    errorText,
    load,
    refresh,
    hasAny,
  };
}
