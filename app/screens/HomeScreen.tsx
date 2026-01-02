// app/screens/homescreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { AvailabilitySlot, SkillLearn, SkillTeach } from "../../lib/api";
import { getMe } from "../../lib/api";
import { getProfileCompletionStatus } from "../../lib/profileCompletion";
import {
  formatTimeAgo,
  readSectionStatus,
  SectionStatus,
} from "../../lib/sectionStatus";
import ProfileStatusCard from "./components/ProfileStatusCard";

import {
  getChatInbox,
  getInboxCache,
  setInboxCache,
  type ChatInboxItem,
} from "../../lib/chat/api";

type User = {
  _id: string;
  fullName: string;
  email: string;
  points?: number;
  xp?: number;
  streak?: number;
  skillsToLearn?: SkillLearn[];
  skillsToTeach?: SkillTeach[];
  availabilitySlots?: AvailabilitySlot[];
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getLevelFromXp(xp?: number) {
  const val = xp ?? 0;
  const level = Math.floor(val / 100);
  const progress = val % 100;
  return { level, progress };
}

function timeToMinutes(t: string) {
  const [h, m] = String(t || "0:0")
    .split(":")
    .map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function calcTotalMinutes(slots: AvailabilitySlot[]) {
  return slots.reduce((sum, s) => {
    const a = timeToMinutes(s.from);
    const b = timeToMinutes(s.to);
    return sum + Math.max(0, b - a);
  }, 0);
}

function minutesToHuman(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatLastUpdated(ts: number | null): string {
  if (!ts) return "Not saved yet";
  return formatTimeAgo(ts);
}

function availabilityLabelFromMinutes(min: number) {
  if (min >= 600) return "🟢 Excellent";
  if (min >= 240) return "🟡 Good";
  if (min > 0) return "🔴 Low";
  return "Not set";
}

// ===== Inbox helpers =====
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

export default function HomeScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [sectionStatus, setSectionStatus] = useState<SectionStatus>({
    weeklyAvailabilityLastSavedAt: null,
    learnHasPendingSync: false,
    teachHasPendingSync: false,
    updatedAt: Date.now(),
  });

  // ===== Inbox state =====
  const [inbox, setInbox] = useState<ChatInboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  const mountedRef = useRef(true);

  const goLogin = useCallback(() => {
    router.replace("/(auth)/login" as any);
  }, [router]);

  const loadInbox = useCallback(async (token: string) => {
    try {
      setInboxLoading(true);

      // ✅ fast boot: cache
      const cached = await getInboxCache();
      if (mountedRef.current && cached?.length) {
        setInbox(cached);
        setInboxLoading(false);
      }

      // ✅ fresh fetch
      const list = await getChatInbox(token);
      if (!mountedRef.current) return;

      const sorted = (Array.isArray(list) ? list : []).slice().sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      setInbox(sorted);
      void setInboxCache(sorted);
    } catch {
      // silent
    } finally {
      if (mountedRef.current) setInboxLoading(false);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setErrorText(null);

      // ✅ One place to read cross-section state
      const st = await readSectionStatus();
      if (mountedRef.current) setSectionStatus(st);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        goLogin();
        return;
      }

      // ✅ load inbox in parallel (no blocking)
      void loadInbox(token);

      const me: any = await getMe(token);
      const userFromApi: User = (me?.user ?? me) as User;

      if (!mountedRef.current) return;
      setUser(userFromApi);
    } catch (err: any) {
      console.log("Home / getMe error:", err);
      if (!mountedRef.current) return;
      setErrorText(
        err?.message || "We couldn’t load your profile. Please pull to refresh."
      );
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [goLogin, loadInbox]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      loadUser();
      return () => {
        mountedRef.current = false;
      };
    }, [loadUser])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadUser();
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    goLogin();
  };

  const handleFindMentor = () => router.push("/find-mentor" as any);
  const handleGoAvailability = () => router.push("/weekly-availability" as any);
  const handleGoTeach = () => router.push("/manage-skills-to-teach" as any);
  const handleGoLearn = () => router.push("/manage-skills-to-learn" as any);
  const handleGoSessions = () => router.push("/sessions" as any);

  // ✅ HOOKS BEFORE ANY EARLY RETURN
  const profileStatus = useMemo(() => getProfileCompletionStatus(user), [user]);

  const xp = user?.xp ?? 0;
  const points = user?.points ?? 0;
  const streak = user?.streak ?? 0;
  const { level, progress } = getLevelFromXp(xp);

  const slots = user?.availabilitySlots ?? [];
  const totalMin = useMemo(() => calcTotalMinutes(slots), [slots]);
  const daysSet = useMemo(
    () => new Set(slots.map((s) => s.dayOfWeek)).size,
    [slots]
  );
  const qualityLabel = availabilityLabelFromMinutes(totalMin);
  const lastUpdatedText = formatLastUpdated(
    sectionStatus.weeklyAvailabilityLastSavedAt
  );

  const bestDay = useMemo(() => {
    if (!slots.length) return null;

    const minutesByDay: number[] = [0, 0, 0, 0, 0, 0, 0];

    for (const s of slots) {
      const d = Number(s.dayOfWeek);
      if (d < 0 || d > 6) continue;

      const val = Math.max(0, timeToMinutes(s.to) - timeToMinutes(s.from));
      minutesByDay[d] += val;
    }

    let bestIdx = -1;
    let bestMin = 0;

    for (let i = 0; i < 7; i++) {
      if (minutesByDay[i] > bestMin) {
        bestMin = minutesByDay[i];
        bestIdx = i;
      }
    }

    if (bestIdx === -1 || bestMin <= 0) return null;
    return `${dayNames[bestIdx]} · ${minutesToHuman(bestMin)}`;
  }, [slots]);

  // ✅ NOW safe to early return
  if (loading && !user && !errorText) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  const pendingChips = [
    sectionStatus.learnHasPendingSync ? "Learn: pending sync" : null,
    sectionStatus.teachHasPendingSync ? "Teach: pending sync" : null,
  ].filter(Boolean) as string[];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
            colors={["#F97316"]}
          />
        }
      >
        {/* ===== Top hero card ===== */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>
                {user ? "Welcome back" : "Welcome to SkillSwap"}
              </Text>
              <Text style={styles.name}>
                {user?.fullName || "SkillSwap user"}
              </Text>
              <Text style={styles.tagline}>
                See your progress, grow your skills, and connect with other
                learners.
              </Text>
            </View>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(user?.fullName)}
              </Text>
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.levelColumn}>
              <Text style={styles.levelLabel}>Level</Text>
              <Text style={styles.levelValue}>{level}</Text>
            </View>

            <View style={styles.progressColumn}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>XP progress</Text>
                <Text style={styles.progressValue}>{progress}/100</Text>
              </View>

              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(progress, 100)}%` },
                  ]}
                />
              </View>
            </View>

            {streak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakText}>{streak}-day streak</Text>
              </View>
            )}
          </View>

          {pendingChips.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              {pendingChips.map((t) => (
                <View key={t} style={styles.pendingChip}>
                  <Text style={styles.pendingChipText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>We couldn’t refresh your data</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadUser}
              activeOpacity={0.85}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <ProfileStatusCard status={profileStatus} />

        {/* ===== Stats row ===== */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>XP</Text>
            <Text style={styles.statValue}>{xp}</Text>
            <Text style={styles.statHint}>Earned by learning from others</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Points</Text>
            <Text style={styles.statValue}>{points}</Text>
            <Text style={styles.statHint}>Earned by teaching others</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Streak</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statHint}>Active days in a row</Text>
          </View>
        </View>

        {/* ===== Quick actions ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionSubtitle}>
            Start from one of these common actions.
          </Text>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickCard, styles.quickPrimary]}
              onPress={handleFindMentor}
              activeOpacity={0.85}
            >
              <Text style={styles.quickEmoji}>🧑‍🏫</Text>
              <Text style={styles.quickTitle}>Find a mentor</Text>
              <Text style={styles.quickText}>
                Discover people who can help you with your learning goals.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickCard, styles.quickSecondary]}
              onPress={handleGoSessions}
              activeOpacity={0.85}
            >
              <Text style={styles.quickEmoji}>📅</Text>
              <Text style={styles.quickTitle}>My sessions</Text>
              <Text style={styles.quickText}>
                View requests, accept/reject, and manage upcoming sessions.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== Messages (Inbox preview) ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Messages</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/(tabs)/chats" as any)}
            >
              <Text style={styles.sectionAction}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inboxCard}>
            {inboxLoading ? (
              <View style={{ paddingVertical: 10 }}>
                <ActivityIndicator />
                <Text
                  style={{ color: "#94A3B8", marginTop: 8, fontWeight: "800" }}
                >
                  Loading messages…
                </Text>
              </View>
            ) : inbox.length === 0 ? (
              <View>
                <Text style={styles.inboxEmptyTitle}>No messages yet</Text>
                <Text style={styles.inboxEmptyBody}>
                  Start by opening any mentor profile and pressing “Message”.
                </Text>

                <TouchableOpacity
                  style={styles.inboxCta}
                  onPress={handleFindMentor}
                  activeOpacity={0.85}
                >
                  <Text style={styles.inboxCtaText}>Find mentors</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {inbox.slice(0, 3).map((c) => {
                  const name = c.peer?.fullName || "Unknown user";
                  const last = c.lastMessageText?.trim()
                    ? c.lastMessageText
                    : "Say hi 👋";
                  const time = inboxTime(c.lastMessageAt);
                  const unread = Number(c.unreadCount || 0);

                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.88}
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/chats/[conversationId]",
                          params: {
                            conversationId: c.id,
                            peerName: c.peer?.fullName || "Chat",
                            peerId: c.peer?.id || "",
                          },
                        } as any)
                      }
                      style={styles.inboxRow}
                    >
                      <View style={styles.inboxAvatar}>
                        <Text style={styles.inboxAvatarText}>
                          {inboxInitials(name)}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={styles.inboxTopLine}>
                          <Text style={styles.inboxName} numberOfLines={1}>
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
                              <View style={styles.inboxBadge}>
                                <Text style={styles.inboxBadgeText}>
                                  {unread > 99 ? "99+" : String(unread)}
                                </Text>
                              </View>
                            )}
                            {!!time && (
                              <Text style={styles.inboxTime}>{time}</Text>
                            )}
                          </View>
                        </View>

                        <Text style={styles.inboxLast} numberOfLines={1}>
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

        {/* ===== Skills learn ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Skills you want to learn</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={handleGoLearn}>
              <Text style={styles.sectionAction}>Manage</Text>
            </TouchableOpacity>
          </View>

          {user?.skillsToLearn?.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalChips}
            >
              {user.skillsToLearn.map((skill, idx) => (
                <View key={`${skill.name}-${idx}`} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {skill.name}
                    {skill.level && skill.level !== "Not specified"
                      ? ` · ${skill.level}`
                      : ""}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No learning goals yet</Text>
              <Text style={styles.emptyText}>
                Add a few skills you’re interested in, so we can match you with
                the right mentors.
              </Text>
              <TouchableOpacity
                style={styles.primaryCta}
                onPress={handleGoLearn}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryCtaText}>Add learning goals</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ===== Skills teach ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Skills you can teach</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={handleGoTeach}>
              <Text style={styles.sectionAction}>Manage</Text>
            </TouchableOpacity>
          </View>

          {user?.skillsToTeach?.length ? (
            <View style={styles.teachList}>
              {user.skillsToTeach.map((skill, idx) => (
                <View key={`${skill.name}-${idx}`} style={styles.teachCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teachName}>{skill.name}</Text>
                    <Text style={styles.teachLevel}>
                      Level: {skill.level || "Not specified"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing to teach yet</Text>
              <Text style={styles.emptyText}>
                Add at least one skill you feel comfortable teaching. This will
                unlock more ways to earn points.
              </Text>
              <TouchableOpacity
                style={styles.primaryCta}
                onPress={handleGoTeach}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryCtaText}>Add teaching skills</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ===== Availability ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your weekly availability</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleGoAvailability}
            >
              <Text style={styles.sectionAction}>
                {slots.length ? "Edit" : "Set now"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.availSummaryCard}>
            <Text style={styles.availSummaryTop}>
              {qualityLabel} · {daysSet} day{daysSet === 1 ? "" : "s"} ·{" "}
              {minutesToHuman(totalMin)} total
            </Text>
            <Text style={styles.availSummaryBottom}>
              {bestDay ? `Best: ${bestDay} · ` : ""}
              Last saved: {lastUpdatedText}
            </Text>
          </View>

          {slots.length ? (
            <View style={styles.availabilityList}>
              {slots.slice(0, 4).map((slot, idx) => (
                <View
                  key={`${slot.dayOfWeek}-${slot.from}-${slot.to}-${idx}`}
                  style={styles.availabilityRow}
                >
                  <Text style={styles.availabilityDay}>
                    {dayNames[slot.dayOfWeek] || "Day"}
                  </Text>
                  <Text style={styles.availabilityTime}>
                    {slot.from} – {slot.to}
                  </Text>
                </View>
              ))}

              {slots.length > 4 && (
                <TouchableOpacity
                  onPress={handleGoAvailability}
                  activeOpacity={0.85}
                  style={styles.availMoreBtn}
                >
                  <Text style={styles.availMoreText}>
                    View all ({slots.length}) →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No availability set</Text>
              <Text style={styles.emptyText}>
                Set 1–2 time slots (evenings/weekend) to improve mentor matches.
              </Text>
              <TouchableOpacity
                style={styles.primaryCta}
                onPress={handleGoAvailability}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryCtaText}>
                  Set availability (2 mins)
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ===== Footer ===== */}
        <View style={styles.footerRow}>
          <Text style={styles.footerHint}>
            Availability saved: {lastUpdatedText}
          </Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, color: "#9CA3AF", fontSize: 14 },

  heroCard: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 12,
  },
  heroRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  greeting: { color: "#9CA3AF", fontSize: 13 },
  name: { color: "#F9FAFB", fontSize: 22, fontWeight: "700", marginTop: 2 },
  tagline: { color: "#64748B", fontSize: 12, marginTop: 6 },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  avatarText: { color: "#F97316", fontSize: 18, fontWeight: "700" },

  heroBottomRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  levelColumn: { width: 64, alignItems: "flex-start" },
  levelLabel: { color: "#94A3B8", fontSize: 11 },
  levelValue: {
    color: "#E5E7EB",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },

  progressColumn: { flex: 1, marginHorizontal: 12 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: "#94A3B8", fontSize: 11 },
  progressValue: { color: "#CBD5F5", fontSize: 11 },
  progressBarBackground: {
    marginTop: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#F97316" },

  streakBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#F97316",
    flexDirection: "row",
    alignItems: "center",
  },
  streakEmoji: { marginRight: 4 },
  streakText: { color: "#FED7AA", fontSize: 11, fontWeight: "600" },

  pendingChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0B1120",
  },
  pendingChipText: { color: "#E5E7EB", fontSize: 11, fontWeight: "800" },

  errorBox: {
    backgroundColor: "#451A1A",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 16,
  },
  errorTitle: {
    color: "#FECACA",
    fontWeight: "600",
    marginBottom: 4,
    fontSize: 13,
  },
  errorBody: { color: "#FECACA", fontSize: 12, marginBottom: 8 },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#B91C1C",
  },
  retryText: { color: "#FEE2E2", fontSize: 12, fontWeight: "500" },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  statLabel: { color: "#94A3B8", fontSize: 11, marginBottom: 4 },
  statValue: { color: "#F9FAFB", fontSize: 18, fontWeight: "700" },
  statHint: { color: "#64748B", fontSize: 10, marginTop: 4 },

  section: { marginBottom: 20 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionTitle: { color: "#F9FAFB", fontSize: 16, fontWeight: "600" },
  sectionSubtitle: { color: "#64748B", fontSize: 12, marginBottom: 8 },
  sectionAction: { color: "#60A5FA", fontSize: 13, fontWeight: "500" },

  quickRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  quickCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1 },
  quickPrimary: { backgroundColor: "#0F172A", borderColor: "#1D4ED8" },
  quickSecondary: { backgroundColor: "#020617", borderColor: "#4B5563" },
  quickEmoji: { fontSize: 20, marginBottom: 6 },
  quickTitle: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  quickText: { color: "#9CA3AF", fontSize: 12 },

  // ===== Inbox styles =====
  inboxCard: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 16,
    padding: 12,
  },
  inboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 14,
    padding: 10,
  },
  inboxAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  inboxAvatarText: { color: "#F97316", fontWeight: "900", fontSize: 14 },
  inboxTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  inboxName: { color: "#E5E7EB", fontWeight: "900", maxWidth: 210 },
  inboxLast: { color: "#94A3B8", marginTop: 4, fontSize: 12 },
  inboxTime: { color: "#64748B", fontSize: 11, fontWeight: "800" },
  inboxBadge: {
    backgroundColor: "#F97316",
    borderWidth: 1,
    borderColor: "#FB923C",
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxBadgeText: { color: "#111827", fontWeight: "900", fontSize: 10 },
  inboxEmptyTitle: { color: "#E5E7EB", fontWeight: "900" },
  inboxEmptyBody: { color: "#94A3B8", marginTop: 6 },
  inboxCta: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#F97316",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  inboxCtaText: { color: "#ffffff", fontWeight: "900" },

  // ===== rest =====
  horizontalChips: { paddingVertical: 4, paddingRight: 4, gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    marginRight: 8,
  },
  chipText: { color: "#E5E7EB", fontSize: 12 },

  emptyCard: {
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#111827",
  },
  emptyTitle: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyText: { color: "#64748B", fontSize: 12 },

  teachList: { gap: 8 },
  teachCard: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  teachName: { color: "#F9FAFB", fontSize: 14, fontWeight: "600" },
  teachLevel: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },

  availSummaryCard: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  availSummaryTop: { color: "#E5E7EB", fontSize: 12, fontWeight: "600" },
  availSummaryBottom: { color: "#94A3B8", fontSize: 11, marginTop: 4 },

  availabilityList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#020617",
    paddingVertical: 4,
  },
  availabilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#020617",
  },
  availabilityDay: { color: "#E5E7EB", fontSize: 13 },
  availabilityTime: { color: "#9CA3AF", fontSize: 13 },

  availMoreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#0B1120",
  },
  availMoreText: { color: "#60A5FA", fontSize: 12, fontWeight: "600" },

  primaryCta: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F97316",
  },
  primaryCtaText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },

  footerRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerHint: { color: "#6B7280", fontSize: 11 },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  logoutText: { color: "#E5E7EB", fontSize: 12 },
});
