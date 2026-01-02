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
}: Props) {
  const listRef = useRef<FlatList<UiMessage>>(null);
  const loadingOlderRef = useRef(false);

  // For inverted FlatList we want newest first
  const data = useMemo(() => {
    const arr = (Array.isArray(items) ? items : []).map((m) => ({
      ...m,
      createdAt:
        typeof (m as any).createdAt === "string"
          ? (m as any).createdAt
          : new Date().toISOString(),
    }));
    arr.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
    return arr;
  }, [items]);

  const keyExtractor = useCallback((m: UiMessage) => m.id, []);

  const renderItem = useCallback(
    ({ item }: { item: UiMessage }) => {
      const mine = String(item.senderId) === String(meId);
      return <MessageBubble item={item} mine={mine} />;
    },
    [meId]
  );

  // When list is inverted: onEndReached means user reached the TOP (older messages)
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

  // Optional: detect if user is not at bottom (newest side)
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // keep for future (scroll-to-bottom button)
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
