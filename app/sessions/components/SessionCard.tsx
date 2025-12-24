import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import type { SessionDTO, SessionStatus } from "../api/sessionsApi";
import { updateSessionStatus } from "../api/sessionsApi";
import { formatSessionDateTime, statusBadge } from "../utils/formatSession";

type Props = {
  session: SessionDTO;
  token: string | null;
  currentUserId: string | null;
  onChanged: () => Promise<void>;
};

function idOf(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return "";
}

export default function SessionCard({
  session,
  token,
  currentUserId,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);

  const badge = useMemo(() => statusBadge(session.status), [session.status]);
  const when = useMemo(
    () => formatSessionDateTime(session.scheduledAt),
    [session.scheduledAt]
  );

  const mentorId = idOf((session as any).mentorId);
  const learnerId = idOf((session as any).learnerId);

  const isMentor = !!currentUserId && currentUserId === mentorId;
  const isLearner = !!currentUserId && currentUserId === learnerId;

  const canAcceptReject = isMentor && session.status === "requested";
  const canCancel =
    isLearner &&
    (session.status === "requested" || session.status === "accepted");
  const canComplete = isMentor && session.status === "accepted";

  const setStatus = async (next: SessionStatus) => {
    if (!token) {
      Alert.alert("Not logged in", "Please login again.");
      return;
    }
    try {
      setBusy(true);
      await updateSessionStatus(token, session._id, next);
      await onChanged();
    } catch (e: any) {
      Alert.alert("Update failed", e?.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: "#0B1120",
        borderWidth: 1,
        borderColor: "#1E293B",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#F9FAFB", fontWeight: "900" }}>
          {session.skill} · {session.level}
        </Text>

        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: badge.bg,
            borderWidth: 1,
            borderColor: badge.border,
          }}
        >
          <Text style={{ color: badge.text, fontWeight: "900", fontSize: 12 }}>
            {badge.label}
          </Text>
        </View>
      </View>

      <Text style={{ color: "#94A3B8", marginTop: 6, fontSize: 12 }}>
        Scheduled: {when}
      </Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
        }}
      >
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator />
            <Text style={{ color: "#94A3B8", fontWeight: "900" }}>
              Updating…
            </Text>
          </View>
        ) : (
          <>
            {canAcceptReject && (
              <>
                <Btn
                  label="Accept"
                  onPress={() => setStatus("accepted")}
                  kind="good"
                />
                <Btn
                  label="Reject"
                  onPress={() => setStatus("rejected")}
                  kind="bad"
                />
              </>
            )}
            {canCancel && (
              <Btn
                label="Cancel"
                onPress={() => setStatus("cancelled")}
                kind="neutral"
              />
            )}
            {canComplete && (
              <Btn
                label="Complete"
                onPress={() => setStatus("completed")}
                kind="primary"
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function Btn({
  label,
  onPress,
  kind,
}: {
  label: string;
  onPress: () => void;
  kind: "primary" | "good" | "bad" | "neutral";
}) {
  const style =
    kind === "good"
      ? { bg: "#22C55E", text: "#022C22", border: "#16A34A" }
      : kind === "bad"
      ? { bg: "#B91C1C", text: "#FEE2E2", border: "#EF4444" }
      : kind === "primary"
      ? { bg: "#F97316", text: "#111827", border: "#FB923C" }
      : { bg: "#020617", text: "#E5E7EB", border: "#334155" };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: style.border,
          backgroundColor: style.bg,
        },
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Text style={{ color: style.text, fontWeight: "900", fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
