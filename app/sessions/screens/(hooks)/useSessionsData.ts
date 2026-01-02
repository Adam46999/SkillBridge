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

function cacheKey(scope: Scope) {
  return `sessions_cache_v1:${scope}`;
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

  const ensureMeId = useCallback(async (t: string) => {
    if (meIdRef.current) return meIdRef.current;

    const me: any = await getMe(t);
    const id = String(me?.user?._id ?? me?._id ?? "").trim() || null;

    meIdRef.current = id;
    if (mountedRef.current) setCurrentUserId(id);

    return id;
  }, []);

  const showCacheIfAvailable = useCallback(async (scopeToUse: Scope) => {
    const key = cacheKey(scopeToUse);

    // لا نعيد عرض الكاش بنفس السكوب كل مرة
    if (shownCacheForScopeRef.current[key]) return;

    const cachedRaw = await AsyncStorage.getItem(key);
    const cached =
      safeJsonParse<{ ts: number; items: SessionDTO[] }>(cachedRaw);

    if (cached?.items?.length && mountedRef.current) {
      setSessions(sortSessions(cached.items));
      // إذا إحنا بأول تحميل، خلي الواجهة تطلع فوراً
      setLoading(false);
    }

    shownCacheForScopeRef.current[key] = true;
  }, []);

  const writeCache = useCallback(async (scopeToUse: Scope, list: SessionDTO[]) => {
    const key = cacheKey(scopeToUse);
    const payload = { ts: Date.now(), items: list };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(
    async (opts?: LoadOpts) => {
      const silent = !!opts?.silent;
      const listOnly = !!opts?.listOnly;
      const force = !!opts?.force;

      const seq = ++reqSeqRef.current;

      try {
        setErrorText(null);

        // ✅ كاش سريع (SWR) إذا مش force
        if (!force) {
          await showCacheIfAvailable(scope);
        }

        if (!silent && !listOnly) setLoading(true);
        if (listOnly) setLoadingList(true);

       console.log("[sessions] load start scope=", scope);

const t = await ensureToken();
console.log("[sessions] got token?", !!t);

if (!t) {
  console.log("[sessions] no token -> redirect login");
  router.replace("/(auth)/login" as any);
  return;
}

if (!meIdRef.current) {
  console.log("[sessions] fetching me...");
  await ensureMeId(t);
  console.log("[sessions] me id =", meIdRef.current);
}

console.log("[sessions] calling listMySessions...");
const data = await listMySessions(t, { scope });
console.log("[sessions] listMySessions returned:", Array.isArray(data) ? data.length : data);


        // ✅ تجاهل نتائج قديمة لو كان في طلب أحدث
        if (!mountedRef.current) return;
        if (seq !== reqSeqRef.current) return;

        const next = sortSessions(Array.isArray(data) ? data : []);
        setSessions(next);
        void writeCache(scope, next);
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (seq !== reqSeqRef.current) return;
        setErrorText(e?.message || "Failed to load sessions.");
      } finally {
        if (!mountedRef.current) return;
        if (seq !== reqSeqRef.current) return;

        if (!silent && !listOnly) setLoading(false);
        if (listOnly) setLoadingList(false);
        setRefreshing(false);
      }
    },
    [ensureMeId, ensureToken, router, scope, showCacheIfAvailable, writeCache]
  );

  // ✅ Initial boot (يعرض كاش + fetch)
  useEffect(() => {
  mountedRef.current = true;

  // أول مرة: خليها تعمل load عادي (يعرض كاش ثم يجدد)
  void load({ silent: false, listOnly: false });

  return () => {
    mountedRef.current = false;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  // ✅ When scope changes: show cache instantly + refresh list only
  useEffect(() => {
  if (!mountedRef.current) return;

  // ✅ skip first run (important) — prevents double-load on mount
  if (!didMountRef.current) {
    didMountRef.current = true;
    return;
  }

  // اعرض كاش للسكوب الجديد فوراً، وبعدين fetch خفيف
  void showCacheIfAvailable(scope);
  void load({ silent: true, listOnly: true });
}, [scope, load, showCacheIfAvailable]);


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true, listOnly: true, force: true });
  }, [load]);

  return useMemo(
    () => ({
      token,
      currentUserId,
      sessions,
      loading,
      loadingList,
      refreshing,
      errorText,
      load,
      onRefresh,
    }),
    [
      token,
      currentUserId,
      sessions,
      loading,
      loadingList,
      refreshing,
      errorText,
      load,
      onRefresh,
    ]
  );
}
