// app/sessions/components/SessionCard.tsx
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform, // ✅ add
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";

import type { SessionDTO, SessionStatus } from "../api/sessionsApi";
import { rateSession, updateSessionStatus } from "../api/sessionsApi";
import { formatSessionDateTime, statusBadge } from "../utils/formatSession";

// ✅ Chat (get/create conversation)
import { getOrCreateConversation } from "../../../lib/chat/api";

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

function toMs(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return t;
}

function isTimeReached(iso: string) {
  const t = toMs(iso);
  if (!t) return false;
  return t <= Date.now();
}

function prettyStatus(s: SessionStatus) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function countdownLabel(scheduledAtIso?: string | null) {
  const t = toMs(scheduledAtIso);
  if (!t) return null;

  const now = Date.now();
  const diff = t - now;

  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  const mLeft = mins % 60;
  const hLeft = hrs % 24;

  const fmt =
    days > 0
      ? `${days}d ${pad2(hLeft)}h`
      : hrs > 0
      ? `${hrs}h ${pad2(mLeft)}m`
      : `${Math.max(0, mins)}m`;

  if (diff > 0) return { kind: "upcoming" as const, text: `Starts in ${fmt}` };
  if (diff <= 0 && abs <= 2 * 60 * 60 * 1000)
    return { kind: "now" as const, text: `Started` };
  return { kind: "past" as const, text: `Ended` };
}

function buildGoogleCalendarUrl(opts: {
  title: string;
  startIso: string;
  details?: string;
  location?: string;
}) {
  // Google Calendar needs YYYYMMDDTHHMMSSZ format (UTC)
  const toGCal = (iso: string) => {
    const d = new Date(iso);
    const t = d.getTime();
    if (Number.isNaN(t)) return null;
    // toISOString => 2026-01-01T12:00:00.000Z
    return d.toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");
  };

  const start = toGCal(opts.startIso);
  if (!start) return null;

  // assume 60 minutes duration (safe default)
  const endDate = new Date(new Date(opts.startIso).getTime() + 60 * 60 * 1000);
  const end = endDate.toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");

  const q = new URLSearchParams();
  q.set("action", "TEMPLATE");
  q.set("text", opts.title);
  q.set("dates", `${start}/${end}`);
  if (opts.details) q.set("details", opts.details);
  if (opts.location) q.set("location", opts.location);

  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// ✅ IMPORTANT: normalize ids to strings (prevents [object Object] issues)
function extractId(v: any) {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return String(v?._id ?? v?.id ?? "").trim();
  return String(v).trim();
}

function safeText(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    if (typeof v === "object") {
      const id = extractId(v);
      if (id) return id;
      return JSON.stringify(v);
    }
    return String(v);
  } catch {
    return String(v);
  }
}

export default function SessionCard({
  session,
  token,
  currentUserId,
  onChanged,
}: Props) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);

  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>("");

  const [detailsOpen, setDetailsOpen] = useState(false);

  const badge = useMemo(() => statusBadge(session.status), [session.status]);
  const when = useMemo(
    () => formatSessionDateTime(session.scheduledAt),
    [session.scheduledAt]
  );

  // ✅ FIX: compare normalized ids (session.mentorId might be object from API)
  const mentorIdStr = useMemo(
    () => extractId((session as any).mentorId),
    [session]
  );
  const learnerIdStr = useMemo(
    () => extractId((session as any).learnerId),
    [session]
  );

  const isMentor = !!currentUserId && currentUserId === mentorIdStr;
  const isLearner = !!currentUserId && currentUserId === learnerIdStr;

  const peerId = useMemo(() => {
    if (!currentUserId) return "";
    return isMentor ? learnerIdStr : mentorIdStr;
  }, [currentUserId, isMentor, learnerIdStr, mentorIdStr]);

  const timeReached = useMemo(
    () => isTimeReached(session.scheduledAt),
    [session.scheduledAt]
  );

  const timeBadge = useMemo(
    () => countdownLabel(session.scheduledAt),
    [session.scheduledAt]
  );

  // ✅ Rules
  const canAcceptReject = isMentor && session.status === "requested";
  const canCancel =
    (isMentor || isLearner) &&
    (session.status === "requested" || session.status === "accepted");

  // ✅ Complete فقط بعد وقت الجلسة
  const canComplete = isMentor && session.status === "accepted" && timeReached;

  // ✅ Rating بعد completion + غير مكرر
  const canRate =
    (isMentor || isLearner) &&
    session.status === "completed" &&
    !session.rating;

  const canMessage = (isMentor || isLearner) && !!token && !!currentUserId;

  const roleLabel = useMemo(() => {
    if (isMentor) return "You are the mentor";
    if (isLearner) return "You are the learner";
    return "Session";
  }, [isLearner, isMentor]);

  const handleShare = async () => {
    try {
      const txt =
        `Session\n` +
        `Skill: ${session.skill}${
          session.level ? ` · ${session.level}` : ""
        }\n` +
        `When: ${when}\n` +
        `Status: ${session.status}\n` +
        (session.note ? `Note: ${session.note}\n` : "") +
        `Session ID: ${session._id}`;

      await Share.share({ message: txt });
    } catch {
      /* silent */
    }
  };

  const handleAddToCalendar = async () => {
    const title = `SkillBridge • ${session.skill}${
      session.level ? ` (${session.level})` : ""
    }`;

    const details =
      `Status: ${session.status}\n` +
      (session.note ? `Note: ${session.note}\n` : "") +
      `Session ID: ${session._id}`;

    const url = buildGoogleCalendarUrl({
      title,
      startIso: session.scheduledAt,
      details,
    });

    if (!url) {
      Alert.alert("Calendar", "Could not generate calendar event (bad date).");
      return;
    }

    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert("Calendar", "Could not open calendar on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Calendar", "Failed to open calendar. Please try again.");
    }
  };

  const handleMessage = async () => {
    try {
      if (!token || !currentUserId) {
        Alert.alert("Not logged in", "Please login again.");
        return;
      }

      if (!peerId) {
        Alert.alert("Chat unavailable", "Could not find the other user.");
        return;
      }

      setBusy(true);

      const conversationId = await getOrCreateConversation(token, peerId);

      if (!conversationId) {
        Alert.alert("Chat failed", "Could not create a conversation.");
        return;
      }

      router.push({
        pathname: "/(tabs)/chats/[conversationId]",
        params: {
          conversationId,
          peerId,
        },
      } as any);
    } catch (e: any) {
      Alert.alert("Chat failed", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (next: SessionStatus) => {
    if (!token) {
      Alert.alert("Not logged in", "Please login again.");
      return;
    }

    const title =
      next === "cancelled"
        ? "Cancel session?"
        : next === "rejected"
        ? "Reject request?"
        : `${prettyStatus(next)}?`;

    const body =
      next === "cancelled"
        ? "This will cancel the session for both sides."
        : next === "rejected"
        ? "This will reject the learner request."
        : `Are you sure you want to set this session to "${next}"?`;

    // ✅ WEB: use confirm (Alert on web might not show)
    if (Platform.OS === "web") {
      const ok = window.confirm(`${title}\n\n${body}`);
      if (!ok) return;

      try {
        setBusy(true);
        await updateSessionStatus(token, session._id, next);
        await onChanged();
      } catch (e: any) {
        window.alert(e?.message || "Update failed. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // ✅ Native: keep Alert.alert
    Alert.alert(title, body, [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style:
          next === "rejected" || next === "cancelled"
            ? "destructive"
            : "default",
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
    ]);
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

  const explainCompleteLocked = () => {
    Alert.alert(
      "Complete is locked",
      "You can complete the session only after the scheduled time is reached."
    );
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
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#F9FAFB", fontWeight: "900", fontSize: 14 }}>
            {session.skill} {session.level ? `· ${session.level}` : ""}
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <Text
              style={{
                color: "#64748B",
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              {roleLabel}
            </Text>

            {timeBadge ? (
              <Text
                style={{
                  color:
                    timeBadge.kind === "upcoming"
                      ? "#93C5FD"
                      : timeBadge.kind === "now"
                      ? "#FDE68A"
                      : "#94A3B8",
                  fontSize: 11,
                  fontWeight: "900",
                }}
              >
                • {timeBadge.text}
              </Text>
            ) : null}
          </View>
        </View>

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

      <Text style={{ color: "#94A3B8", marginTop: 10, fontSize: 12 }}>
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

      {/* Top quick actions */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
        }}
      >
        <ActionBtn
          label={detailsOpen ? "Hide details" : "Details"}
          kind="neutral"
          disabled={busy}
          onPress={() => setDetailsOpen((v) => !v)}
        />

        <ActionBtn
          label="Calendar"
          kind="neutral"
          disabled={busy}
          onPress={handleAddToCalendar}
        />

        <ActionBtn
          label="Share"
          kind="neutral"
          disabled={busy}
          onPress={handleShare}
        />
      </View>

      {/* Details */}
      {detailsOpen ? (
        <View
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#111827",
            backgroundColor: "#020617",
            gap: 10,
          }}
        >
          <DetailRow k="Status" v={prettyStatus(session.status)} />
          <DetailRow k="When" v={safeText(when)} />
          {!!peerId && <DetailRow k="Peer ID" v={safeText(peerId)} />}
          <DetailRow k="Mentor ID" v={safeText(mentorIdStr)} />
          <DetailRow k="Learner ID" v={safeText(learnerIdStr)} />
          <DetailRow k="Session ID" v={safeText(session._id)} />
          {!!session.createdAt && (
            <DetailRow
              k="Created"
              v={formatSessionDateTime(session.createdAt)}
            />
          )}
          {!!session.updatedAt && (
            <DetailRow
              k="Updated"
              v={formatSessionDateTime(session.updatedAt)}
            />
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
        ) : null}

        {canMessage && (
          <ActionBtn
            label="Message"
            kind="neutral"
            disabled={busy}
            onPress={handleMessage}
          />
        )}

        {canAcceptReject && (
          <>
            <ActionBtn
              label="Accept"
              kind="good"
              disabled={busy}
              onPress={() => setStatus("accepted")}
            />
            <ActionBtn
              label="Reject"
              kind="bad"
              disabled={busy}
              onPress={() => setStatus("rejected")}
            />
          </>
        )}

        {canCancel && (
          <ActionBtn
            label="Cancel"
            kind="neutral"
            disabled={busy}
            onPress={() => setStatus("cancelled")}
          />
        )}

        {/* ✅ Complete disabled (practical) */}
        {isMentor && session.status === "accepted" && !timeReached ? (
          <ActionBtn
            label="Complete (after time)"
            kind="neutral"
            disabled={busy}
            onPress={explainCompleteLocked}
          />
        ) : null}

        {canComplete && (
          <ActionBtn
            label="Complete"
            kind="primary"
            disabled={busy}
            onPress={() => setStatus("completed")}
          />
        )}

        {canRate && (
          <ActionBtn
            label="Rate session"
            kind="primary"
            disabled={busy}
            onPress={() => setRateOpen(true)}
          />
        )}
      </View>

      {/* Rate Modal */}
      <Modal
        visible={rateOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRateOpen(false)}
      >
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

            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= rating;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setRating(n)}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? "#F97316" : "#334155",
                        backgroundColor: active ? "#111827" : "#020617",
                      },
                      pressed ? { opacity: 0.9 } : null,
                    ]}
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
                disabled={busy}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#334155",
                    backgroundColor: "#020617",
                    opacity: busy ? 0.7 : 1,
                  },
                  pressed ? { opacity: 0.9 } : null,
                ]}
              >
                <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={submitRating}
                disabled={busy}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#FB923C",
                    backgroundColor: "#F97316",
                    opacity: busy ? 0.7 : 1,
                  },
                  pressed ? { opacity: 0.92 } : null,
                ]}
              >
                <Text style={{ color: "#111827", fontWeight: "900" }}>
                  {busy ? "Submitting…" : "Submit"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: "#94A3B8", fontWeight: "800", fontSize: 12 }}>
        {k}
      </Text>
      <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
        {v || "—"}
      </Text>
    </View>
  );
}

function ActionBtn({
  label,
  onPress,
  kind,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind: "primary" | "good" | "bad" | "neutral";
  disabled?: boolean;
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
      disabled={!!disabled}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: styleByKind.border,
          backgroundColor: styleByKind.bg,
          opacity: disabled ? 0.6 : 1,
        },
        pressed && !disabled ? { opacity: 0.9 } : null,
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
