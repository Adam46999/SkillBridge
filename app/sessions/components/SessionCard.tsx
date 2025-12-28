// app/sessions/components/SessionCard.tsx
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import type { SessionDTO, SessionStatus } from "../api/sessionsApi";
import { rateSession, updateSessionStatus } from "../api/sessionsApi";
import { formatSessionDateTime, statusBadge } from "../utils/formatSession";

type Props = {
  session: SessionDTO;
  token: string | null;
  currentUserId: string | null;
  onChanged: () => Promise<void>;
};

function clampInt(v: number, min: number, max: number) {
  const n = Math.floor(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function SessionCard({
  session,
  token,
  currentUserId,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);

  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>("");

  const badge = useMemo(() => statusBadge(session.status), [session.status]);
  const when = useMemo(
    () => formatSessionDateTime(session.scheduledAt),
    [session.scheduledAt]
  );

  const isMentor = !!currentUserId && currentUserId === session.mentorId;
  const isLearner = !!currentUserId && currentUserId === session.learnerId;

  // ✅ Rules (محترمة وواقعية)
  const canAcceptReject = isMentor && session.status === "requested";
  const canCancel =
    (isMentor || isLearner) &&
    (session.status === "requested" || session.status === "accepted");
  const canComplete = isMentor && session.status === "accepted";

  // ✅ Rating يظهر بعد completion + غير مكرر
  const canRate =
    (isMentor || isLearner) &&
    session.status === "completed" &&
    !session.rating;

  const setStatus = async (next: SessionStatus) => {
    if (!token) {
      Alert.alert("Not logged in", "Please login again.");
      return;
    }

    const pretty = next.charAt(0).toUpperCase() + next.slice(1).toLowerCase();

    Alert.alert(
      `${pretty}?`,
      `Are you sure you want to set this session to "${next}"?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "default",
          onPress: async () => {
            try {
              setBusy(true);
              await updateSessionStatus(token, session._id, next);
              await onChanged();
            } catch (e: any) {
              Alert.alert("Update failed", e?.message || "Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const submitRating = async () => {
    if (!token) {
      Alert.alert("Not logged in", "Please login again.");
      return;
    }

    try {
      setBusy(true);
      await rateSession(token, session._id, {
        rating: clampInt(rating, 1, 5),
        feedback: feedback.trim(),
      });
      setRateOpen(false);
      setFeedback("");
      setRating(5);
      await onChanged();
      Alert.alert("Thanks ✅", "Your rating was submitted.");
    } catch (e: any) {
      Alert.alert("Rating failed", e?.message || "Please try again.");
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
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Text style={{ color: "#F9FAFB", fontWeight: "900", fontSize: 14 }}>
          {session.skill} {session.level ? `· ${session.level}` : ""}
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

      <Text style={{ color: "#94A3B8", marginTop: 8, fontSize: 12 }}>
        Scheduled: {when}
      </Text>

      {!!session.note && (
        <Text style={{ color: "#CBD5E1", marginTop: 6, fontSize: 12 }}>
          Note: {session.note}
        </Text>
      )}

      {/* Rating summary (if already rated) */}
      {session.status === "completed" && session.rating ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: "#FDE68A", fontWeight: "900", fontSize: 12 }}>
            Rated: {"⭐".repeat(Math.max(1, Math.min(5, session.rating)))} (
            {session.rating}/5)
          </Text>
          {!!session.feedback && (
            <Text style={{ color: "#94A3B8", marginTop: 4, fontSize: 12 }}>
              Feedback: {session.feedback}
            </Text>
          )}
        </View>
      ) : null}

      {/* Actions */}
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
              Working…
            </Text>
          </View>
        ) : (
          <>
            {canAcceptReject && (
              <>
                <ActionBtn
                  label="Accept"
                  kind="good"
                  onPress={() => setStatus("accepted")}
                />
                <ActionBtn
                  label="Reject"
                  kind="bad"
                  onPress={() => setStatus("rejected")}
                />
              </>
            )}

            {canCancel && (
              <ActionBtn
                label="Cancel"
                kind="neutral"
                onPress={() => setStatus("cancelled")}
              />
            )}

            {canComplete && (
              <ActionBtn
                label="Complete"
                kind="primary"
                onPress={() => setStatus("completed")}
              />
            )}

            {canRate && (
              <ActionBtn
                label="Rate session"
                kind="primary"
                onPress={() => setRateOpen(true)}
              />
            )}
          </>
        )}
      </View>

      {/* Rate Modal */}
      <Modal visible={rateOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "#0B1120",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#1E293B",
              padding: 14,
            }}
          >
            <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 16 }}>
              Rate this session
            </Text>

            <Text style={{ color: "#94A3B8", marginTop: 6, fontSize: 12 }}>
              Give a quick rating and optional feedback.
            </Text>

            {/* Stars row */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= rating;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setRating(n)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? "#F97316" : "#334155",
                      backgroundColor: active ? "#111827" : "#020617",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#FED7AA" : "#94A3B8",
                        fontWeight: "900",
                      }}
                    >
                      ⭐ {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Optional feedback…"
              placeholderTextColor="#64748B"
              multiline
              style={{
                marginTop: 12,
                minHeight: 90,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1F2937",
                backgroundColor: "#020617",
                color: "#E5E7EB",
                paddingHorizontal: 12,
                paddingVertical: 10,
                textAlignVertical: "top",
                fontWeight: "700",
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={() => setRateOpen(false)}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#334155",
                  backgroundColor: "#020617",
                }}
              >
                <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={submitRating}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#FB923C",
                  backgroundColor: "#F97316",
                }}
              >
                <Text style={{ color: "#111827", fontWeight: "900" }}>
                  Submit
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionBtn({
  label,
  onPress,
  kind,
}: {
  label: string;
  onPress: () => void;
  kind: "primary" | "good" | "bad" | "neutral";
}) {
  const styleByKind =
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
          borderColor: styleByKind.border,
          backgroundColor: styleByKind.bg,
        },
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Text
        style={{ color: styleByKind.text, fontWeight: "900", fontSize: 12 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
