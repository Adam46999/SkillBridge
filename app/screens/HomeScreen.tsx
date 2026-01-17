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

import CollapsibleCard from "./home/components/CollapsibleCard";
import HomeHero from "./home/components/HomeHero";
import InboxPreview from "./home/components/InboxPreview";
import MiniStatsRow from "./home/components/MiniStatsRow";
import SectionHeader from "./home/components/SectionHeader";
import StickyPrimaryCTA from "./home/components/StickyPrimaryCTA";

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

function availabilityLabelFromMinutes(min: number) {
  if (min >= 600) return "🟢 Excellent";
  if (min >= 240) return "🟡 Good";
  if (min > 0) return "🔴 Low";
  return "Not set";
}

function formatLastUpdated(ts: number | null): string {
  if (!ts) return "Not saved yet";
  return formatTimeAgo(ts);
}

function inferNextLine(user: User | null, inbox: ChatInboxItem[]) {
  const learnCount = user?.skillsToLearn?.length || 0;
  const hasInbox = inbox.length > 0;

  if (learnCount === 0)
    return "Next: add a learning goal to get better matches.";
  if (!hasInbox) return "Next: find a mentor and send your first message.";
  return "Next: open a chat or request a session with a mentor.";
}

export default function HomeScreen() {
  const router = useRouter();
  const mountedRef = useRef(true);

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

  const [inbox, setInbox] = useState<ChatInboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  const [setupOpen, setSetupOpen] = useState(true);
  const [teachOpen, setTeachOpen] = useState(false);

  const goLogin = useCallback(() => {
    router.replace("/(auth)/login");
  }, [router]);

  const loadInbox = useCallback(async (token: string) => {
    try {
      setInboxLoading(true);

      const cached = await getInboxCache();
      if (mountedRef.current && cached?.length) {
        setInbox(cached);
        setInboxLoading(false);
      }

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

      const st = await readSectionStatus();
      if (mountedRef.current) setSectionStatus(st);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        goLogin();
        return;
      }

      void loadInbox(token);

      const me: any = await getMe(token);
      const userFromApi: User = (me?.user ?? me) as User;

      if (!mountedRef.current) return;
      setUser(userFromApi);

      // UX: if user already teaches, open teach by default
      const hasTeach = (userFromApi.skillsToTeach?.length || 0) > 0;
      setTeachOpen(hasTeach);
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

  // Navigation handlers (no behavior change)
  const handleFindMentor = () => router.push("/find-mentor");
  const handleGoAvailability = () => router.push("/weekly-availability");
  const handleGoTeach = () => router.push("/manage-skills-to-teach");
  const handleGoLearn = () => router.push("/manage-skills-to-learn");
  const handleGoSessions = () => router.push("/sessions");
  const handleOpenAllChats = () => router.push("/(tabs)/chats");

  const handleOpenChat = (c: ChatInboxItem) => {
    router.push({
      pathname: "/(tabs)/chats/[conversationId]",
      params: {
        conversationId: c.id,
        peerName: c.peer?.fullName || "Chat",
        peerId: c.peer?.id || "",
      },
    });
  };

  // Derived UI state
  const profileStatus = useMemo(() => getProfileCompletionStatus(user), [user]);

  const xp = user?.xp ?? 0;
  const points = user?.points ?? 0;
  const streak = user?.streak ?? 0;

  const { level, progress } = getLevelFromXp(xp);
  const slots = useMemo(() => user?.availabilitySlots ?? [], [user?.availabilitySlots]);
  const totalMin = useMemo(() => calcTotalMinutes(slots), [slots]);
  const daysSet = useMemo(() => new Set(slots.map((s) => s.dayOfWeek)).size, [slots]);
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
      minutesByDay[d] += Math.max(
        0,
        timeToMinutes(s.to) - timeToMinutes(s.from)
      );
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

  const nextLine = useMemo(() => inferNextLine(user, inbox), [user, inbox]);

  const isNewLearner = useMemo(() => {
    const learnCount = user?.skillsToLearn?.length || 0;
    const teachCount = user?.skillsToTeach?.length || 0;
    const hasAvail = (user?.availabilitySlots?.length || 0) > 0;
    const hasInbox = inbox.length > 0;
    return learnCount === 0 && teachCount === 0 && !hasAvail && !hasInbox;
  }, [user, inbox]);

  if (loading && !user && !errorText) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* START HERE */}
        <HomeHero
          fullName={user?.fullName}
          initials={getInitials(user?.fullName)}
          level={level}
          progress={progress}
          streak={streak}
          nextLine={nextLine}
          onPrimary={handleFindMentor}
          onSecondary={handleGoSessions}
        />

        {errorText ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>We couldn’t refresh your data</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={loadUser}
              activeOpacity={0.85}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ProfileStatusCard status={profileStatus} />
        <MiniStatsRow xp={xp} points={points} streak={streak} />

        {/* YOUR ACTIVITY */}
        <View style={{ marginBottom: 10 }}>
          <SectionHeader
            icon="📌"
            title="Your activity"
            subtitle="Keep an eye on sessions and messages."
          />
          <View style={styles.activityRow}>
            <TouchableOpacity
              style={[styles.activityCard, styles.activityPrimary]}
              onPress={handleGoSessions}
              activeOpacity={0.85}
            >
              <Text style={styles.activityEmoji}>📅</Text>
              <Text style={styles.activityTitle}>My sessions</Text>
              <Text style={styles.activityText}>
                View requests, upcoming sessions, and actions.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.activityCard, styles.activitySecondary]}
              onPress={handleOpenAllChats}
              activeOpacity={0.85}
            >
              <Text style={styles.activityEmoji}>💬</Text>
              <Text style={styles.activityTitle}>Chats</Text>
              <Text style={styles.activityText}>
                Open conversations and reply fast.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <InboxPreview
          loading={inboxLoading}
          inbox={inbox ?? []}
          onOpenAll={handleOpenAllChats}
          onFindMentor={handleFindMentor}
          onOpenChat={handleOpenChat}
        />

        {/* SETUP (Collapsible) */}
        <CollapsibleCard
          title="Setup"
          icon="🧩"
          open={setupOpen}
          onToggle={() => setSetupOpen((v) => !v)}
        >
          {/* Learn */}
          <View style={styles.section}>
            <SectionHeader
              icon="📚"
              title="Skills you want to learn"
              actionLabel="Manage"
              onAction={handleGoLearn}
            />
            {user?.skillsToLearn?.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
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
                  Add a few skills you’re interested in, so we can match you
                  with the right mentors.
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

          {/* Availability */}
          <View style={styles.section}>
            <SectionHeader
              icon="⏰"
              title="Your weekly availability"
              actionLabel={slots.length ? "Edit" : "Set now"}
              onAction={handleGoAvailability}
            />

            <View style={styles.availSummary}>
              <Text style={styles.availTop}>
                {qualityLabel} · {daysSet} day{daysSet === 1 ? "" : "s"} ·{" "}
                {minutesToHuman(totalMin)} total
              </Text>
              <Text style={styles.availBottom}>
                {bestDay ? `Best: ${bestDay} · ` : ""}
                Last saved: {lastUpdatedText}
              </Text>
            </View>

            {slots.length ? (
              <View style={styles.availList}>
                {slots.slice(0, 4).map((slot, idx) => (
                  <View
                    key={`${slot.dayOfWeek}-${slot.from}-${slot.to}-${idx}`}
                    style={styles.availRow}
                  >
                    <Text style={styles.availDay}>
                      {dayNames[slot.dayOfWeek] || "Day"}
                    </Text>
                    <Text style={styles.availTime}>
                      {slot.from} – {slot.to}
                    </Text>
                  </View>
                ))}

                {slots.length > 4 ? (
                  <TouchableOpacity
                    onPress={handleGoAvailability}
                    activeOpacity={0.85}
                    style={styles.availMoreBtn}
                  >
                    <Text style={styles.availMoreText}>
                      View all ({slots.length}) →
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No availability set</Text>
                <Text style={styles.emptyText}>
                  Set 1–2 time slots (evenings/weekend) to improve mentor
                  matches.
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

          {/* Teach (Collapsible inside setup) */}
          <CollapsibleCard
            title="Skills you can teach"
            icon="🧑‍🏫"
            open={teachOpen}
            onToggle={() => setTeachOpen((v) => !v)}
          >
            {user?.skillsToTeach?.length ? (
              <View style={{ gap: 8 }}>
                {user.skillsToTeach.map((skill, idx) => (
                  <View key={`${skill.name}-${idx}`} style={styles.teachCard}>
                    <Text style={styles.teachName}>{skill.name}</Text>
                    <Text style={styles.teachLevel}>
                      Level: {skill.level || "Not specified"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nothing to teach yet</Text>
                <Text style={styles.emptyText}>
                  Add one skill you can teach to unlock more ways to earn
                  points.
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
          </CollapsibleCard>
        </CollapsibleCard>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.footerHint}>
            Availability saved: {lastUpdatedText}
          </Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: isNewLearner ? 90 : 16 }} />
      </ScrollView>

      {/* Sticky primary CTA for brand-new learners */}
      <StickyPrimaryCTA visible={isNewLearner} onPress={handleFindMentor} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, color: "#9CA3AF", fontSize: 14 },

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
    fontWeight: "800",
    marginBottom: 4,
    fontSize: 13,
  },
  errorBody: { color: "#FECACA", fontSize: 12, marginBottom: 8 },
  retryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#B91C1C",
  },
  retryText: { color: "#FEE2E2", fontSize: 12, fontWeight: "800" },

  activityRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  activityCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1 },
  activityPrimary: { backgroundColor: "#0F172A", borderColor: "#1D4ED8" },
  activitySecondary: { backgroundColor: "#020617", borderColor: "#334155" },
  activityEmoji: { fontSize: 20, marginBottom: 6 },
  activityTitle: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  activityText: { color: "#9CA3AF", fontSize: 12, lineHeight: 18 },

  section: { marginBottom: 18 },

  chipsRow: { paddingVertical: 4, paddingRight: 4, gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    marginRight: 8,
  },
  chipText: { color: "#E5E7EB", fontSize: 12, fontWeight: "700" },

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
    fontWeight: "900",
    marginBottom: 4,
  },
  emptyText: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },

  primaryCta: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F97316",
  },
  primaryCtaText: { color: "#0B1120", fontWeight: "900", fontSize: 13 },

  availSummary: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  availTop: { color: "#E5E7EB", fontSize: 12, fontWeight: "800" },
  availBottom: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "700",
  },

  availList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#020617",
    paddingVertical: 4,
  },
  availRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#020617",
  },
  availDay: { color: "#E5E7EB", fontSize: 13, fontWeight: "800" },
  availTime: { color: "#9CA3AF", fontSize: 13, fontWeight: "700" },
  availMoreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#0B1120",
  },
  availMoreText: { color: "#60A5FA", fontSize: 12, fontWeight: "900" },

  teachCard: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  teachName: { color: "#F9FAFB", fontSize: 14, fontWeight: "900" },
  teachLevel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "700",
  },

  footerRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerHint: { color: "#6B7280", fontSize: 11, fontWeight: "700" },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  logoutText: { color: "#E5E7EB", fontSize: 12, fontWeight: "800" },
});
