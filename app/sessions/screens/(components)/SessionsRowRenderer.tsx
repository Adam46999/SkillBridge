// app/sessions/screens/(components)/SessionsRowRenderer.tsx
import React, { useCallback, useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { SessionDTO } from "../../api/sessionsApi";
import SessionCard from "../../components/SessionCard";
import type { Row } from "./SessionsRows";

type Props = {
  token: string | null;
  currentUserId: string | null;
  onChanged: () => Promise<void> | void;

  // ✅ NEW
  onDeletedLocal?: (sessionId: string) => void;
};

function pluralize(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function useRowRenderer({
  token,
  currentUserId,
  onChanged,
  onDeletedLocal,
}: Props) {
  const safeOnChanged = useCallback(async () => {
    try {
      await onChanged?.();
    } catch {
      /* ignore */
    }
  }, [onChanged]);

  // ✅ double-tap guard (خصوصاً على موبايل)
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);
  const canTap = useCallback((id: string) => {
    const now = Date.now();
    const prev = lastTapRef.current;
    if (prev && prev.id === id && now - prev.at < 550) return false;
    lastTapRef.current = { id, at: now };
    return true;
  }, []);

  return useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === "header") {
        const n = Number(item.count || 0);
        return (
          <View
            style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#CBD5E1", fontWeight: "900" }}>
                {item.title}
              </Text>

              <Text
                style={{ color: "#64748B", fontWeight: "900", fontSize: 12 }}
              >
                {n} {pluralize(n, "session", "sessions")}
              </Text>
            </View>
          </View>
        );
      }

      const s = item.session as SessionDTO;
      const sid = String(
        (s as any)?._id || (s as any)?.id || item.key || ""
      ).trim();

      return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable
            onPress={() => {
              if (!sid) return;
              canTap(sid);
            }}
            style={({ pressed }) => [
              { borderRadius: 16 },
              pressed ? { opacity: 0.98 } : null,
            ]}
          >
            <SessionCard
              session={s}
              token={token}
              currentUserId={currentUserId}
              onChanged={safeOnChanged}
              // ✅ NEW (SessionCard رح نستعمله بعد شوي)
              onDeletedLocal={onDeletedLocal}
            />
          </Pressable>
        </View>
      );
    },
    [token, currentUserId, safeOnChanged, canTap, onDeletedLocal]
  );
}

export function UpdatingMiniBadge() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <ActivityIndicator />
      <Text style={{ color: "#94A3B8", fontWeight: "900" }}>Updating…</Text>
    </View>
  );
}
