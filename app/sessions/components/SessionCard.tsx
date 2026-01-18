// app/sessions/components/SessionCard.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import type { SessionDTO, SessionStatus } from "../api/sessionsApi";
import {
  deleteSessionSmart,
  joinSession,
  rateSession,
  updateSessionStatus,
} from "../api/sessionsApi";
import { getOrCreateConversation } from "../../../lib/chat/api";

import { formatSessionDateTime, statusBadge } from "../utils/formatSession";

// ---------------- helpers (unchanged style) ----------------
function toMs(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) ? t : null;
}

function isTimeReached(iso?: string | null) {
  const t = toMs(iso);
  if (!t) return false;
  return t <= Date.now();
}

function minutesUntil(iso?: string | null) {
  const t = toMs(iso);
  if (!t) return null;
  const diff = t - Date.now();
  return Math.floor(diff / 60000);
}

function minutesSince(iso?: string | null) {
  const t = toMs(iso);
  if (!t) return null;
  const diff = Date.now() - t;
  return Math.floor(diff / 60000);
}

function formatAgo(iso?: string | null) {
  const since = minutesSince(iso);
  if (since === null) return "—";
  if (since > 60) return `${Math.round(since / 60)}h ago`;
  return `${since}m ago`;
}

// mirror backend RULES (UI only)
const RULES = {
  JOIN_EARLY_MIN: 30,
  JOIN_LATE_MIN: 180,
  COMPLETE_MAX_DELAY_MIN: 24 * 60,
};

function canJoinNow(iso?: string | null) {
  const until = minutesUntil(iso);
  if (until === null) return { ok: false, reason: "Invalid time" };

  if (until > 0 && until <= RULES.JOIN_EARLY_MIN) return { ok: true };
  if (until <= 0) {
    const since = minutesSince(iso);
    if (since !== null && since <= RULES.JOIN_LATE_MIN) return { ok: true };
    return { ok: false, reason: "Join window expired" };
  }
  return { ok: false, reason: "Too early" };
}

function canCompleteNow(iso?: string | null) {
  if (!isTimeReached(iso))
    return { ok: false, reason: "Too early to complete" };
  const since = minutesSince(iso);
  if (since === null) return { ok: false, reason: "Invalid time" };
  if (since > RULES.COMPLETE_MAX_DELAY_MIN)
    return { ok: false, reason: "Completion window expired" };
  return { ok: true };
}

function getId(v: any) {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);

  if (typeof v === "object") {
    // support ObjectId-like / populated docs
    const id = v._id || v.id;
    if (id) return String(id).trim();
  }

  return "";
}

// ---------------- UI atoms ----------------
function ActionBtn({
  label,
  kind,
  onPress,
  disabled,
}: {
  label: string;
  kind: "primary" | "danger" | "neutral";
  onPress: () => void;
  disabled?: boolean;
}) {
  const bg =
    kind === "primary" ? "#10B981" : kind === "danger" ? "#EF4444" : "#334155";

  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: disabled ? "#1F2937" : bg,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "#E2E8F0", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#0F172A",
        borderWidth: 1,
        borderColor: "#1F2937",
      }}
    >
      <Text style={{ color: "#CBD5E1", fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

// ---------------- Component ----------------
export default function SessionCard({
  session,
  token,
  currentUserId,
  onChanged,
  onDeletedLocal, // ✅ NEW
}: {
  session: SessionDTO;
  token: string | null;
  currentUserId: string | null;
  onChanged: () => Promise<void> | void;

  // ✅ NEW
  onDeletedLocal?: (sessionId: string) => void;
}) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);

  const [rateOpen, setRateOpen] = useState(false);
  const [rateValue, setRateValue] = useState("30");
  const [rateFeedback, setRateFeedback] = useState("");

  // ✅ FIX (no behavior change): stable id fallback
  const sessionId =
    getId((session as any)?._id) ||
    getId((session as any)?.id) ||
    getId((session as any)?.sessionId);

  const [uiStatus, setUiStatus] = useState<SessionStatus>(
    (session.status as SessionStatus) || "requested"
  );

  useEffect(() => {
    setUiStatus((session.status as SessionStatus) || "requested");
  }, [session.status]);

  const timeReached = useMemo(
    () => isTimeReached(session.scheduledAt),
    [session.scheduledAt]
  );

  const joinCheck = useMemo(
    () => canJoinNow(session.scheduledAt),
    [session.scheduledAt]
  );
  const completeCheck = useMemo(
    () => canCompleteNow(session.scheduledAt),
    [session.scheduledAt]
  );

  const myId = getId(currentUserId);

  // mentorId / learnerId ممكن يجوا كـ string أو object (populated) أو ObjectId
  const mentorId =
    getId((session as any).mentorId) || getId((session as any).mentor);
  const learnerId =
    getId((session as any).learnerId) || getId((session as any).learner);

  console.log("DBG", {
    myId,
    mentorId,
    learnerId,
    status: session.status,
    sessionId,
  });

  const isMentor = !!myId && mentorId === myId;
  const isLearner = !!myId && learnerId === myId;

  const joinedBy = Array.isArray((session as any).joinedBy)
    ? (session as any).joinedBy.map((x: any) => getId(x)).filter(Boolean)
    : [];

  const mentorJoined = !!mentorId && joinedBy.includes(mentorId);

  // ✅ Rules (UI mirrors backend)
  const canAcceptReject = isMentor && uiStatus === "requested" && !timeReached;

  const canCancel =
    (isMentor || isLearner) &&
    (uiStatus === "requested" || uiStatus === "accepted");

  const canJoin =
    (isMentor || isLearner) && uiStatus === "accepted" && joinCheck.ok;

  const canComplete = isMentor && uiStatus === "accepted" && completeCheck.ok && mentorJoined;

  const canRate = (isMentor || isLearner) && uiStatus === "completed" && !(session as any).rating;

  const setStatus = async (next: SessionStatus) => {
    if (!token) {
      Alert.alert("Not logged in", "Please login again.");
      return;
    }

    // ✅ no behavior change; just prevents broken call
    if (!sessionId) {
      Alert.alert("Missing id", "This session has no id.");
      return;
    }

    const title = "Confirm action";
    const body =
      next === "accepted"
        ? "This will accept the learner request."
        : next === "cancelled"
        ? "This will cancel the session for both sides."
        : next === "rejected"
        ? "This will reject the learner request."
        : next === "completed"
        ? "This will mark the session as completed."
        : `Are you sure you want to set this session to "${next}"?`;

    if (Platform.OS === "web") {
      // @ts-ignore
      const ok = window.confirm(`${title}\n\n${body}`);
      if (!ok) return;
    } else {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(title, body, [
          { text: "No", style: "cancel", onPress: () => resolve(false) },
          { text: "Yes", style: "destructive", onPress: () => resolve(true) },
        ]);
      });
      if (!ok) return;
    }

    try {
      setBusy(true);
      await updateSessionStatus(token, sessionId, next);

      // ✅ تحديث محلي فوري للكرت (NO side effects)
      setUiStatus(next);

      await onChanged();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async () => {
    if (!token) return Alert.alert("Not logged in", "Please login again.");
    console.log("JOIN CLICK", { sessionId, raw: session });

    if (!sessionId) return Alert.alert("Missing id", "This session has no id.");

    try {
      setBusy(true);

      // 1) حاول سجّل join بالسيرفر (اذا نافذة الجوين مسموحة)
      // لو فشل (too early / expired / already joined) ما بنوقف التجربة
      try {
        await joinSession(token, sessionId);
      } catch (e: any) {
        // ignore join errors here; room will still open
        console.log("JoinSession skipped:", e?.message);
      }

      // 2) Open or create the conversation with the peer and navigate to Chat
      const peerId = isMentor ? learnerId : mentorId;
      try {
        const tokenLocal = token as string;
        const convId = await getOrCreateConversation(tokenLocal, peerId);
        router.push({
          pathname: "/(tabs)/chats/[conversationId]",
          params: { conversationId: convId, peerId, peerName: otherName },
        } as any);
      } catch (e: any) {
        console.log("Failed to open conversation, falling back to session room:", e?.message);
        router.push(`/sessions/room/${sessionId}`);
      }

      // 3) sync
      await onChanged();
    } catch (e: any) {
      Alert.alert("Join failed", e?.message || "Join failed");
    } finally {
      setBusy(false);
    }
  };

  const doSmartDelete = async () => {
    if (!token) return Alert.alert("Not logged in", "Please login again.");
    if (!sessionId) return Alert.alert("Missing id", "This session has no id.");

    const title = "Delete session";

    const body =
      session.status === "accepted"
        ? "Deleting an accepted session will cancel it for both users. The other user will see a notice."
        : session.status === "requested"
        ? isLearner
          ? "This will cancel your request and remove it from your list."
          : "This will reject the request and remove it from your list."
        : "This will remove this session from your list.";

    if (Platform.OS === "web") {
      // @ts-ignore
      const ok = window.confirm(`${title}\n\n${body}`);
      if (!ok) return;
    } else {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(title, body, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ]);
      });
      if (!ok) return;
    }
    try {
      setBusy(true);
      await deleteSessionSmart(token, sessionId);

      // ✅ NEW: يخفيها فوراً من قدامك
      onDeletedLocal?.(sessionId);

      // ✅ خليه عشان يعمل sync بعدين
      await onChanged();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const submitRate = async () => {
    if (!token) return Alert.alert("Not logged in", "Please login again.");
    if (!sessionId) return Alert.alert("Missing id", "This session has no id.");

    const n = Number(rateValue);
    if (!Number.isFinite(n) || n < 10 || n > 50) {
      Alert.alert("Invalid points", "Please enter points between 10 and 50.");
      return;
    }

    try {
      setBusy(true);
      await rateSession(token, sessionId, {
        rating: n,
        feedback: rateFeedback,
      });
      setRateOpen(false);
      await onChanged();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Rating failed");
    } finally {
      setBusy(false);
    }
  };

  const title = `${session.skill} • ${session.level || "Not specified"}`;
  const timeLine = formatSessionDateTime(session.scheduledAt);
  const badge = statusBadge(uiStatus);
  const badgeText = typeof badge === "string" ? badge : badge.label;
  const otherName = isMentor
    ? (session as any)?.learner?.fullName ||
      (session as any)?.learner?.email ||
      "Learner"
    : isLearner
    ? (session as any)?.mentor?.fullName ||
      (session as any)?.mentor?.email ||
      "Mentor"
    : (session as any)?.mentor?.fullName ||
      (session as any)?.mentor?.email ||
      (session as any)?.learner?.fullName ||
      (session as any)?.learner?.email ||
      "User";

  const sessionDeleteNotice = (session as any)?.deleteNotice;
  const sessionCancelReason = (session as any)?.cancelReason;

  const cancelNotice = useMemo(() => {
    const st = String(uiStatus || "").toLowerCase();
    if (st !== "cancelled" && st !== "rejected") return "";

    const dn = String(sessionDeleteNotice || "").trim();
    if (dn) return dn;

    const cr = String(sessionCancelReason || "").trim();
    if (cr === "expired_request") return "This request expired automatically.";
    if (cr === "missed") return "Session time passed and was cancelled.";
    if (cr === "late_cancel") return "Cancelled late.";
    if (cr) return "Cancelled.";

    if (st === "rejected") return "This request was rejected.";
    return "Cancelled.";
  }, [uiStatus, sessionDeleteNotice, sessionCancelReason]);

  return (
    <View
      style={{
        backgroundColor: "#0B1220",
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: "#1F2937",
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: "#E2E8F0", fontSize: 16, fontWeight: "800" }}>
            {title}
          </Text>
          <Text style={{ color: "#94A3B8", marginTop: 4 }}>{timeLine}</Text>
          <Text style={{ color: "#64748B", marginTop: 4 }}>
            With: {otherName}
            {!!cancelNotice && (
              <Text
                style={{ color: "#FBBF24", marginTop: 6, fontWeight: "700" }}
              >
                {cancelNotice}
              </Text>
            )}
          </Text>
          
          {uiStatus === "completed" && (session as any).rating && (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 14 }}>
                ⭐ Rating: {(session as any).rating} points
              </Text>
              {(session as any).feedback && (
                <Text style={{ color: "#94A3B8", fontSize: 13, fontStyle: "italic" }}>
                  "{(session as any).feedback}"
                </Text>
              )}
            </View>
          )}
        </View>

        <Badge text={badgeText} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {canAcceptReject && (
          <>
            <ActionBtn
              label="Accept"
              kind="primary"
              onPress={() => {
                setStatus("accepted");
              }}
              disabled={busy}
            />

            <ActionBtn
              label="Reject"
              kind="danger"
              onPress={() => setStatus("rejected")}
              disabled={busy}
            />
          </>
        )}

        {canCancel && (
          <ActionBtn
            label="Cancel"
            kind="danger"
            onPress={() => setStatus("cancelled")}
            disabled={busy}
          />
        )}

        {canJoin && (
          <ActionBtn
            label="Join"
            kind="primary"
            onPress={doJoin}
            disabled={busy}
          />
        )}

        {uiStatus === "accepted" && !canJoin && (
          <ActionBtn
            label={joinCheck.ok ? "Join" : "Join (not available)"}
            kind="neutral"
            onPress={() => {}}
            disabled={true}
          />
        )}

        {canComplete && (
          <ActionBtn
            label="Complete"
            kind="primary"
            onPress={() => setStatus("completed")}
            disabled={busy}
          />
        )}

        {uiStatus === "accepted" && !canComplete && timeReached && (
          <ActionBtn
            label={
              mentorJoined ? "Complete (blocked)" : "Complete (join first)"
            }
            kind="neutral"
            onPress={() => {}}
            disabled={true}
          />
        )}

        {canRate && (
          <ActionBtn
            label="Rate"
            kind="primary"
            onPress={() => setRateOpen(true)}
            disabled={busy}
          />
        )}

        {uiStatus !== "completed" && (
          <ActionBtn
            label="Delete"
            kind="neutral"
            onPress={doSmartDelete}
            disabled={busy}
          />
        )}

        {busy && <ActivityIndicator />}
      </View>

      <Modal visible={rateOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#0B1220",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "#1F2937",
              gap: 12,
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "800", fontSize: 16 }}>
              Rate session with points
            </Text>

            <Text style={{ color: "#94A3B8" }}>
              Award 10-50 points to the {isMentor ? "learner" : "mentor"} and add optional feedback.
            </Text>

            <TextInput
              value={rateValue}
              onChangeText={setRateValue}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor="#64748B"
              style={{
                borderWidth: 1,
                borderColor: "#1F2937",
                borderRadius: 12,
                padding: 10,
                color: "#E2E8F0",
              }}
            />

            <TextInput
              value={rateFeedback}
              onChangeText={setRateFeedback}
              placeholder="Feedback (optional)"
              placeholderTextColor="#64748B"
              style={{
                borderWidth: 1,
                borderColor: "#1F2937",
                borderRadius: 12,
                padding: 10,
                color: "#E2E8F0",
                minHeight: 80,
              }}
              multiline
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setRateOpen(false)}
                disabled={busy}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: busy ? "#1F2937" : "#334155",
                  opacity: busy ? 0.6 : 1,
                  flex: 1,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#E2E8F0", fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitRate}
                disabled={busy}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: busy ? "#1F2937" : "#10B981",
                  opacity: busy ? 0.6 : 1,
                  flex: 1,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#E2E8F0", fontWeight: "700" }}>Submit</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Modal>

      <Text style={{ color: "#475569" }}>
        Updated{" "}
        {formatAgo((session as any)?.updatedAt || (session as any)?.createdAt)}
      </Text>
    </View>
  );
}
