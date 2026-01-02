import React, { useMemo } from "react";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

export type ConnStatus = "connected" | "reconnecting" | "disconnected";

type Props = {
  title: string; // peerName
  onBack: () => void;

  // realtime UI
  conn: ConnStatus;
  peerTyping: boolean;
  peerOnline: boolean;
  peerLastSeenIso: string | null;
};

function initials(name?: string) {
  const n = String(name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0][0] || "?").toUpperCase();
  return `${parts[0][0] || ""}${
    parts[parts.length - 1][0] || ""
  }`.toUpperCase();
}

function formatLastSeen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatHeader({
  title,
  onBack,
  conn,
  peerTyping,
  peerOnline,
  peerLastSeenIso,
}: Props) {
  const isRTL = I18nManager.isRTL;

  const subtitle = useMemo(() => {
    if (peerTyping) return isRTL ? "يكتب…" : "typing…";

    if (conn === "reconnecting")
      return isRTL ? "جاري إعادة الاتصال…" : "reconnecting…";
    if (conn !== "connected") return isRTL ? "غير متصل" : "offline";

    if (peerOnline) return isRTL ? "متصل الآن" : "online";
    if (peerLastSeenIso) {
      const seen = formatLastSeen(peerLastSeenIso);
      return isRTL ? `آخر ظهور ${seen}` : `last seen ${seen}`;
    }
    return isRTL ? "غير متصل" : "offline";
  }, [conn, peerLastSeenIso, peerOnline, peerTyping, isRTL]);

  const avatar = useMemo(() => initials(title), [title]);

  const dot = useMemo(() => {
    if (peerTyping) return "#FBBF24"; // yellow
    if (conn !== "connected") return "#64748B"; // gray
    if (peerOnline) return "#22C55E"; // green
    return "#64748B";
  }, [conn, peerOnline, peerTyping]);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [
          styles.backBtn,
          pressed ? { opacity: 0.9 } : null,
        ]}
        hitSlop={12}
      >
        <Text style={styles.backText}>{isRTL ? "→" : "←"}</Text>
      </Pressable>

      <View style={styles.center}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatar}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={styles.title}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title || "Chat"}
          </Text>

          <View style={styles.subRow}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
      </View>

      {/* right spacer (future actions: call/info) */}
      <View style={{ width: 44 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#0B1120",
    backgroundColor: "#020617",
  },

  backBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#60A5FA",
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 18,
  },

  center: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 6,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#F97316",
    fontWeight: "900",
    fontSize: 14,
  },

  title: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 15,
    maxWidth: 260,
  },

  subRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  sub: {
    color: "#94A3B8",
    fontWeight: "800",
    fontSize: 11,
  },
});
