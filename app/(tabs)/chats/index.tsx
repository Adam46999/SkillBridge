import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getChatInbox,
  getInboxCache,
  setInboxCache,
  type ChatInboxItem,
} from "../../../lib/chat/api";
import {
  connectChatSocket,
  disconnectChatSocket,
  onNewMessage,
} from "../../../lib/chat/socket";

function initials(name?: string) {
  const n = String(name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${
    parts[parts.length - 1][0] ?? ""
  }`.toUpperCase();
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

type LoadMode = "load" | "refresh";

export default function ChatsInboxScreen() {
  const router = useRouter();

  const [items, setItems] = useState<ChatInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const load = useCallback(
    async (mode: LoadMode) => {
      try {
        setErrorText(null);

        if (mode === "refresh") setRefreshing(true);
        else setLoading(true);

        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/(auth)/login" as any);
          return;
        }

        // ✅ عرض الكاش بسرعة (بس عند load مش refresh)
        if (mode === "load") {
          const cached = await getInboxCache();
          if (mountedRef.current && cached?.length) {
            const sortedCached = cached.slice().sort((a, b) => {
              const ta = a.lastMessageAt
                ? new Date(a.lastMessageAt).getTime()
                : 0;
              const tb = b.lastMessageAt
                ? new Date(b.lastMessageAt).getTime()
                : 0;
              return tb - ta;
            });
            setItems(sortedCached);
            setLoading(false);
          }
        }

        const list = await getChatInbox(token);

        if (!mountedRef.current) return;

        const sorted = (Array.isArray(list) ? list : [])
          .slice()
          .sort((a, b) => {
            const ta = a.lastMessageAt
              ? new Date(a.lastMessageAt).getTime()
              : 0;
            const tb = b.lastMessageAt
              ? new Date(b.lastMessageAt).getTime()
              : 0;
            return tb - ta;
          });

        setItems(sorted);
        void setInboxCache(sorted);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setErrorText(e?.message || "Failed to load chats.");
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;

      // load from cache + fetch
      load("load");

      // realtime inbox updates
      let offMsg: (() => void) | null = null;

      (async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token || !mountedRef.current) return;

        connectChatSocket(token);

        offMsg = onNewMessage((m) => {
          // Move conversation to top + update preview/unread fast
          setItems((prev) => {
            const list = Array.isArray(prev) ? prev.slice() : [];
            const idx = list.findIndex(
              (x) => String(x.id) === String(m.conversationId)
            );

            const nextItem: ChatInboxItem =
              idx >= 0
                ? {
                    ...list[idx],
                    lastMessageText: m.text || list[idx].lastMessageText,
                    lastMessageAt: m.createdAt || list[idx].lastMessageAt,
                    unreadCount: Number(list[idx].unreadCount || 0) + 1,
                  }
                : {
                    id: String(m.conversationId),
                    peer: null,
                    lastMessageText: String(m.text || ""),
                    lastMessageAt: String(
                      m.createdAt || new Date().toISOString()
                    ),
                    updatedAt: null,
                    createdAt: null,
                    unreadCount: 1,
                  };

            if (idx >= 0) list.splice(idx, 1);
            const merged = [nextItem, ...list];

            void setInboxCache(merged);
            return merged;
          });
        });
      })();

      return () => {
        mountedRef.current = false;
        try {
          offMsg?.();
        } catch {}
        try {
          disconnectChatSocket();
        } catch {}
      };
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((x) => {
      const name = String(x.peer?.fullName || "").toLowerCase();
      const last = String(x.lastMessageText || "").toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }, [items, query]);

  const empty = useMemo(
    () => !loading && !errorText && filtered.length === 0,
    [loading, errorText, filtered.length]
  );

  const openConversation = useCallback(
    (item: ChatInboxItem) => {
      const id = String(item?.id || "").trim();
      if (!id) return;
      if (pendingOpenId === id) return;

      setPendingOpenId(id);

      router.push({
        pathname: "/(tabs)/chats/[conversationId]",
        params: {
          conversationId: id,
          peerName: item.peer?.fullName || "Chat",
          peerId: item.peer?.id || "",
        },
      } as any);

      setTimeout(() => setPendingOpenId(null), 650);
    },
    [pendingOpenId, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatInboxItem }) => {
      const name = item.peer?.fullName || "Unknown user";
      const last = item.lastMessageText?.trim()
        ? item.lastMessageText
        : "Say hi 👋";
      const ts = item.lastMessageAt ? timeAgo(item.lastMessageAt) : "";
      const unread = Number((item as any)?.unreadCount || 0);
      const disabled = pendingOpenId === item.id;

      return (
        <Pressable
          onPress={() => openConversation(item)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Open chat with ${name}`}
          accessibilityHint="Opens the conversation"
          style={({ pressed }) => [
            styles.row,
            pressed ? { opacity: 0.92 } : null,
            disabled ? { opacity: 0.65 } : null,
          ]}
          hitSlop={10}
        >
          <View style={styles.avatar} accessibilityLabel={`Avatar: ${name}`}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.topLine}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>

              <View style={styles.rightMeta}>
                {!!unread && (
                  <View
                    style={styles.badge}
                    accessibilityLabel={`${unread} unread messages`}
                  >
                    <Text style={styles.badgeText}>
                      {unread > 99 ? "99+" : String(unread)}
                    </Text>
                  </View>
                )}

                {!!ts && <Text style={styles.time}>{ts}</Text>}
              </View>
            </View>

            <Text
              style={[styles.last, unread ? styles.lastUnread : null]}
              numberOfLines={2}
            >
              {last}
            </Text>
          </View>
        </Pressable>
      );
    },
    [openConversation, pendingOpenId]
  );

  const keyExtractor = useCallback((x: ChatInboxItem) => x.id, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Chats
        </Text>
        <Text style={styles.subtitle}>Your 1:1 conversations (text only).</Text>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or message…"
            placeholderTextColor="#64748B"
            style={styles.searchInput}
            accessibilityLabel="Search chats"
            accessibilityHint="Filters conversations by name or last message"
            returnKeyType="search"
          />
          {!!query.trim() && (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={({ pressed }) => [
                styles.clearBtn,
                pressed ? { opacity: 0.9 } : null,
              ]}
              hitSlop={10}
            >
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : errorText ? (
        <View style={{ padding: 16 }}>
          <View style={styles.errCard}>
            <Text style={styles.errTitle}>Couldn’t load chats</Text>
            <Text style={styles.errBody}>{errorText}</Text>

            <Pressable
              onPress={() => load("load")}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              style={({ pressed }) => [
                styles.tryBtn,
                pressed ? { opacity: 0.9 } : null,
              ]}
              hitSlop={10}
            >
              <Text style={styles.tryText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      ) : empty ? (
        <View style={{ padding: 16 }}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {query.trim() ? "No results" : "No chats yet"}
            </Text>
            <Text style={styles.emptyBody}>
              {query.trim()
                ? "Try a different search."
                : "Open any mentor profile and press “Message”."}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor="#94A3B8"
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 26 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel="Chats list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },

  header: { padding: 16, paddingBottom: 10 },
  title: { color: "#E5E7EB", fontWeight: "900", fontSize: 18 },
  subtitle: { color: "#94A3B8", marginTop: 6, fontSize: 12 },

  searchWrap: {
    marginTop: 12,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchIcon: { color: "#64748B", fontWeight: "900" },
  searchInput: { flex: 1, color: "#E5E7EB", fontWeight: "700" },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 18,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#94A3B8", marginTop: 10, fontWeight: "800" },

  errCard: {
    backgroundColor: "#451A1A",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  errTitle: { color: "#FECACA", fontWeight: "900" },
  errBody: { color: "#FECACA", marginTop: 6 },

  tryBtn: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "#B91C1C",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tryText: { color: "#FEE2E2", fontWeight: "900" },

  emptyCard: {
    backgroundColor: "#0B1120",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  emptyTitle: { color: "#E5E7EB", fontWeight: "900" },
  emptyBody: { color: "#94A3B8", marginTop: 6 },

  row: {
    backgroundColor: "#0B1120",
    borderColor: "#111827",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 66,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#F97316", fontWeight: "900", fontSize: 16 },

  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  name: { color: "#E5E7EB", fontWeight: "900", maxWidth: 220 },

  rightMeta: { flexDirection: "row", alignItems: "center", gap: 8 },

  time: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    writingDirection: "ltr",
  },

  badge: {
    backgroundColor: "#F97316",
    borderWidth: 1,
    borderColor: "#FB923C",
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#111827", fontWeight: "900", fontSize: 11 },

  last: { color: "#94A3B8", marginTop: 6 },
  lastUnread: { color: "#E5E7EB", fontWeight: "900" },
});
