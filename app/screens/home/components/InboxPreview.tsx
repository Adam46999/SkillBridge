import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { ChatInboxItem } from "../../../../lib/chat/api";

type Props = {
  loading: boolean;
  inbox?: ChatInboxItem[] | null; // ✅ allow undefined/null (defensive)
  onOpenAll: () => void;
  onFindMentor: () => void;
  onOpenChat: (item: ChatInboxItem) => void;
};

function inboxTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inboxInitials(name?: string) {
  const n = String(name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || "?").toUpperCase();
  return `${parts[0][0] || ""}${
    parts[parts.length - 1][0] || ""
  }`.toUpperCase();
}

export default function InboxPreview({
  loading,
  inbox,
  onOpenAll,
  onFindMentor,
  onOpenChat,
}: Props) {
  // ✅ hard guard: inbox might be undefined at runtime
  const list = useMemo(() => (Array.isArray(inbox) ? inbox : []), [inbox]);

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>💬 Messages</Text>

        <TouchableOpacity
          onPress={onOpenAll}
          activeOpacity={0.85}
          style={styles.chip}
        >
          <Text style={styles.chipText}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {loading ? (
          <View style={{ paddingVertical: 10, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading messages…</Text>
          </View>
        ) : list.length === 0 ? (
          <View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>
              Start by finding a mentor. After opening their profile, you can
              send a message.
            </Text>

            <TouchableOpacity
              style={styles.cta}
              onPress={onFindMentor}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Find mentors</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {list.slice(0, 3).map((c, idx) => {
              const name = c?.peer?.fullName || "Unknown user";
              const last =
                c?.lastMessageText && c.lastMessageText.trim().length > 0
                  ? c.lastMessageText
                  : "Tap to continue the chat";
              const time = inboxTime(c?.lastMessageAt);
              const unread = Number(c?.unreadCount || 0);

              // ✅ defensive key
              const key = c?.id ? String(c.id) : `fallback-${idx}`;

              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.88}
                  onPress={() => onOpenChat(c)}
                  style={styles.row}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{inboxInitials(name)}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.topLine}>
                      <Text style={styles.name} numberOfLines={1}>
                        {name}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {!!unread && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {unread > 99 ? "99+" : String(unread)}
                            </Text>
                          </View>
                        )}
                        {!!time && <Text style={styles.time}>{time}</Text>}
                      </View>
                    </View>

                    <Text style={styles.last} numberOfLines={1}>
                      {last}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { color: "#F9FAFB", fontSize: 16, fontWeight: "800" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0B1120",
  },
  chipText: { color: "#60A5FA", fontSize: 12, fontWeight: "800" },

  card: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 16,
    padding: 12,
  },

  loadingText: { color: "#94A3B8", marginTop: 8, fontWeight: "900" },

  emptyTitle: { color: "#E5E7EB", fontWeight: "900", fontSize: 13 },
  emptyBody: { color: "#94A3B8", marginTop: 6, fontSize: 12, lineHeight: 18 },
  cta: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#F97316",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { color: "#0B1120", fontWeight: "900" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 14,
    padding: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#F97316", fontWeight: "900", fontSize: 14 },

  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  name: { color: "#E5E7EB", fontWeight: "900", maxWidth: 210 },
  last: { color: "#94A3B8", marginTop: 4, fontSize: 12 },

  time: { color: "#64748B", fontSize: 11, fontWeight: "900" },
  badge: {
    backgroundColor: "#F97316",
    borderWidth: 1,
    borderColor: "#FB923C",
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#111827", fontWeight: "900", fontSize: 10 },
});
