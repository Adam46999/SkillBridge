// app/sessions/room/[id]/components/RoomHeader.tsx
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { SessionDTO } from "../../../api/sessionsApi";

function fmtCountdown(sec: number | null) {
  if (sec === null) return "—";
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

export default function RoomHeader({
  session,
  countdownSeconds,
  joinEnabled,
  joinHint,
  busy,
  onJoin,
  onCancel,
  onRefresh,
  onBack,
}: {
  session: SessionDTO;
  countdownSeconds: number | null;
  joinEnabled: boolean;
  joinHint: string;
  busy: boolean;
  onJoin: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const statusText = useMemo(
    () => String(session.status).toUpperCase(),
    [session.status]
  );

  const showJoin = session.status === "accepted";
  const showCancel =
    session.status !== "completed" && session.status !== "cancelled";

  return (
    <View
      style={{
        backgroundColor: "#0B1220",
        borderWidth: 1,
        borderColor: "#1F2937",
        borderRadius: 16,
        padding: 12,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#E2E8F0", fontWeight: "900", fontSize: 16 }}>
            {session.skill || "Session"}{" "}
            {session.level ? `• ${session.level}` : ""}
          </Text>

          <Text style={{ color: "#94A3B8", marginTop: 4 }}>
            {session.scheduledAt
              ? new Date(session.scheduledAt).toLocaleString()
              : "—"}
          </Text>

          <Text style={{ color: "#64748B", marginTop: 4 }}>
            Starts in:{" "}
            {countdownSeconds !== null && countdownSeconds > 0
              ? fmtCountdown(countdownSeconds)
              : "Started"}
          </Text>

          {showJoin ? (
            <Text
              style={{
                color: joinEnabled ? "#22C55E" : "#F59E0B",
                marginTop: 6,
              }}
            >
              {joinHint}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "#111827",
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>
              {statusText}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {showJoin ? (
          <Pressable
            onPress={onJoin}
            disabled={!joinEnabled || busy}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: !joinEnabled || busy ? "#14532D" : "#22C55E",
              opacity: !joinEnabled || busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#052E16", fontWeight: "900" }}>
              Join (Zoom)
            </Text>
          </Pressable>
        ) : null}

        {showCancel ? (
          <Pressable
            onPress={onCancel}
            disabled={busy}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "#334155",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Cancel</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onRefresh}
          disabled={busy}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: "#1F2937",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Refresh</Text>
        </Pressable>

        <Pressable
          onPress={onBack}
          disabled={busy}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: "#0F172A",
            borderWidth: 1,
            borderColor: "#1F2937",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>
            My Sessions
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
