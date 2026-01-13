import React, { useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import type { ChatMessage } from "../../../../lib/chat/api";
import MessageBubble from "./MessageBubble";
import TopLoadingHint from "./TopLoadingHint";

type UiMessage = ChatMessage & { createdAt: string };

type Props = {
  items: ChatMessage[];
  meId: string;
  paging: boolean;
  hasMore: boolean;
  onLoadOlder: () => Promise<void>;

  // ✅ NEW: timestamp when peer read messages in this conversation
  // passed from ConversationScreen (peerReadAtIso state)
  peerReadAtIso?: string | null;

  // ✅ optional (backward compatible): if you still want to pass id
  seenLastMineId?: string | null;
};

function toTime(iso: string) {
  const d = new Date(iso);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function MessagesList({
  items,
  meId,
  paging,
  hasMore,
  onLoadOlder,
  peerReadAtIso,
  seenLastMineId,
}: Props) {
  const listRef = useRef<FlatList<UiMessage>>(null);
  const loadingOlderRef = useRef(false);

  const data = useMemo(() => {
    const arr = (Array.isArray(items) ? items : []).map((m) => ({
      ...m,
      createdAt:
        typeof (m as any).createdAt === "string"
          ? (m as any).createdAt
          : new Date().toISOString(),
    }));
    arr.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)); // newest first for inverted list
    return arr;
  }, [items]);

  // ✅ last outgoing (mine) message (newest mine because list is newest-first)
  const lastMine = useMemo(() => {
    return data.find((m) => String(m.senderId) === String(meId)) || null;
  }, [data, meId]);

  const lastMineId = lastMine?.id || null;

  // ✅ if peerReadAtIso exists, and peerReadAt >= lastMine.createdAt => last mine is seen
  const computedSeenLastMineId = useMemo(() => {
    if (!lastMine) return null;
    if (!peerReadAtIso) return null;

    const readT = toTime(String(peerReadAtIso));
    const msgT = toTime(String(lastMine.createdAt));
    if (!readT || !msgT) return null;

    return readT >= msgT ? String(lastMine.id) : null;
  }, [lastMine, peerReadAtIso]);

  // ✅ final seen id (prefer computed from timestamp; fallback to prop)
  const effectiveSeenLastMineId =
    computedSeenLastMineId || (seenLastMineId ? String(seenLastMineId) : null);

  const keyExtractor = useCallback((m: UiMessage) => m.id, []);

  const renderItem = useCallback(
    ({ item }: { item: UiMessage }) => {
      const mine = String(item.senderId) === String(meId);
      const isLastMine =
        mine && !!lastMineId && String(item.id) === String(lastMineId);

      const seen =
        isLastMine &&
        !!effectiveSeenLastMineId &&
        String(effectiveSeenLastMineId) === String(item.id);

      return (
        <MessageBubble
          item={item}
          mine={mine}
          isLastMine={isLastMine}
          lastMineId={lastMineId}
          seen={seen}
        />
      );
    },
    [effectiveSeenLastMineId, lastMineId, meId]
  );

  const onEndReached = useCallback(async () => {
    if (!hasMore) return;
    if (paging) return;
    if (loadingOlderRef.current) return;

    loadingOlderRef.current = true;
    try {
      await onLoadOlder();
    } finally {
      loadingOlderRef.current = false;
    }
  }, [hasMore, onLoadOlder, paging]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    void e;
  }, []);

  return (
    <View style={styles.wrap}>
      <TopLoadingHint visible={paging} />

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        inverted
        onEndReached={onEndReached}
        onEndReachedThreshold={0.2}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#020617" },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
});
