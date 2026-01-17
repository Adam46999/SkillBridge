// app/mentor/[id].tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { getOrCreateConversation } from "../../lib/chat/api";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AvailabilitySlot,
  PublicUserProfile,
  SkillTeach,
  getPublicUserProfile,
} from "../../lib/api";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

function ratingText(avg?: number, count?: number) {
  const a = typeof avg === "number" ? avg : 0;
  const c = typeof count === "number" ? count : 0;
  if (c <= 0) return "No ratings yet";
  return `${a.toFixed(1)}/5 · ${c} rating${c === 1 ? "" : "s"}`;
}

function safeArrayStrings(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

type MentorVM = {
  id: string;
  fullName: string;
  points: number;
  xp: number;
  streak: number;
  avgRating: number;
  ratingCount: number;
  skillsToTeach: SkillTeach[];
  availabilitySlots: AvailabilitySlot[];
  preferences?: { communicationModes?: string[]; languages?: string[] };
};

function toMentorVM(p: PublicUserProfile): MentorVM {
  return {
    id: String(p.id),
    fullName: p.fullName || "Unknown",
    points: Number(p.points || 0),
    xp: Number(p.xp || 0),
    streak: Number(p.streak || 0),
    avgRating: Number(p.avgRating || 0),
    ratingCount: Number(p.ratingCount || 0),
    skillsToTeach: Array.isArray(p.skillsToTeach)
      ? p.skillsToTeach
          .filter((s) => s && s.name)
          .map((s) => ({
            name: String(s.name).trim(),
            level: String(s.level || "Not specified").trim() || "Not specified",
          }))
      : [],
    availabilitySlots: Array.isArray(p.availabilitySlots)
      ? p.availabilitySlots
          .filter(
            (a) =>
              a &&
              typeof a.dayOfWeek === "number" &&
              a.dayOfWeek >= 0 &&
              a.dayOfWeek <= 6 &&
              a.from &&
              a.to
          )
          .map((a) => ({
            dayOfWeek: Number(a.dayOfWeek),
            from: String(a.from),
            to: String(a.to),
          }))
      : [],
    preferences: p.preferences,
  };
}

export default function MentorProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  React.useEffect(() => {
    try {
      (navigation as any)?.setOptions?.({ headerShown: false });
    } catch {}
  }, [navigation]);
  const params = useLocalSearchParams();

  const mentorIdRaw = params?.id;
  const mentorId =
    typeof mentorIdRaw === "string"
      ? mentorIdRaw
      : Array.isArray(mentorIdRaw)
      ? mentorIdRaw[0]
      : "";

  const [mentor, setMentor] = useState<MentorVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadMentor = useCallback(async () => {
    try {
      setErrorText(null);
      setLoading(true);

      if (!mentorId) {
        setErrorText("Invalid mentor id.");
        return;
      }

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const profile = await getPublicUserProfile(token, mentorId);
      setMentor(toMentorVM(profile));
    } catch (e: any) {
      setErrorText(e?.message || "Failed to load mentor profile.");
    } finally {
      setLoading(false);
    }
  }, [mentorId, router]);

  useEffect(() => {
    loadMentor();
  }, [loadMentor, reloadKey]);

  const skills = useMemo(
    () => mentor?.skillsToTeach ?? [],
    [mentor?.skillsToTeach]
  );

  const slots = useMemo(
    () =>
      (mentor?.availabilitySlots ?? [])
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    [mentor?.availabilitySlots]
  );

  const totalMin = useMemo(() => calcTotalMinutes(slots), [slots]);

  const bestDay = useMemo(() => {
    if (!slots.length) return null;
    const minutesByDay = [0, 0, 0, 0, 0, 0, 0];

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

  const languages = safeArrayStrings(mentor?.preferences?.languages);
  const commModes = safeArrayStrings(mentor?.preferences?.communicationModes);

  const goBack = () => router.back();

  const handleRequestSession = () => {
    if (!mentor) return;

    router.push({
      pathname: "/sessions/request",
      params: {
        mentorId: mentor.id,
        mentorName: mentor.fullName,
      },
    });
  };

  const handleMessage = async () => {
    try {
      if (!mentor?.id) return;

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const conversationId = await getOrCreateConversation(token, mentor.id);

      // ✅ هذا السطر هو الحل
      if (!conversationId || typeof conversationId !== "string") {
        console.warn("Invalid conversationId, aborting chat open");
        return;
      }

      router.push({
        pathname: "/(tabs)/chats/[conversationId]",
        params: { conversationId },
      });
    } catch (e: any) {
      console.warn("Open chat failed:", e?.message || e);
    }
  };

  if (loading && !mentor && !errorText) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading mentor profile…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={goBack} activeOpacity={0.85}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.idBadge}>
            <Text style={styles.idBadgeText}>Mentor</Text>
          </View>
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn’t load profile</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setReloadKey((k) => k + 1)}
              activeOpacity={0.85}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(mentor?.fullName)}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>
                {mentor?.fullName || "Unknown mentor"}
              </Text>
              <Text style={styles.heroMeta}>
                ⭐ {ratingText(mentor?.avgRating, mentor?.ratingCount)}
              </Text>

              <View style={styles.badgesRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>XP</Text>
                  <Text style={styles.badgeValue}>{mentor?.xp ?? 0}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>Points</Text>
                  <Text style={styles.badgeValue}>{mentor?.points ?? 0}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>Streak</Text>
                  <Text style={styles.badgeValue}>{mentor?.streak ?? 0}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={[styles.ctaBtn, styles.ctaPrimary]}
              onPress={handleRequestSession}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaPrimaryText}>Request session</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctaBtn, styles.ctaSecondary]}
              onPress={handleMessage}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaSecondaryText}>Message</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.ctaNote}>
            (Next step: we’ll connect these buttons to Sessions + Chat)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What this mentor teaches</Text>
          <Text style={styles.sectionSub}>
            Skills list (clean & fast) — ready for future filters.
          </Text>

          {skills.length ? (
            <View style={styles.skillsWrap}>
              {skills.map((s, idx) => (
                <View key={`${s.name}-${idx}`} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>
                    {s.name}
                    {s.level && s.level !== "Not specified"
                      ? ` · ${s.level}`
                      : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No teaching skills listed</Text>
              <Text style={styles.emptyText}>
                This mentor hasn’t added teaching skills yet.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Text style={styles.sectionSub}>
            Total:{" "}
            <Text style={styles.sectionSubStrong}>
              {minutesToHuman(totalMin)}
            </Text>
            {bestDay ? (
              <>
                {"  "}· Best:{" "}
                <Text style={styles.sectionSubStrong}>{bestDay}</Text>
              </>
            ) : null}
          </Text>

          {slots.length ? (
            <View style={styles.availCard}>
              {slots.map((a, idx) => (
                <View
                  key={`${a.dayOfWeek}-${a.from}-${a.to}-${idx}`}
                  style={[
                    styles.availRow,
                    idx !== slots.length - 1 && styles.availRowBorder,
                  ]}
                >
                  <Text style={styles.availDay}>
                    {dayNames[a.dayOfWeek] ?? `Day ${a.dayOfWeek}`}
                  </Text>
                  <Text style={styles.availTime}>
                    {a.from} – {a.to}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No availability set</Text>
              <Text style={styles.emptyText}>
                This mentor didn’t add weekly availability yet.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.prefGrid}>
            <View style={styles.prefBox}>
              <Text style={styles.prefLabel}>Languages</Text>
              <Text style={styles.prefValue}>
                {languages.length ? languages.join(", ") : "Not specified"}
              </Text>
            </View>

            <View style={styles.prefBox}>
              <Text style={styles.prefLabel}>Communication</Text>
              <Text style={styles.prefValue}>
                {commModes.length ? commModes.join(", ") : "Not specified"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            You’re viewing a mentor profile (not yours) ✅
          </Text>
          <TouchableOpacity
            onPress={goBack}
            style={styles.footerBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.footerBtnText}>Back to results</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

export const options = {
  title: "Mentor profile",
  headerTitle: "Mentor profile",
  headerShown: false,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  container: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 10, color: "#9CA3AF", fontSize: 14 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backText: { fontSize: 14, color: "#60A5FA" },
  idBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#0B1120",
  },
  idBadgeText: { color: "#CBD5F5", fontSize: 12, fontWeight: "600" },

  errorBox: {
    backgroundColor: "#451A1A",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 12,
  },
  errorTitle: {
    color: "#FECACA",
    fontWeight: "700",
    marginBottom: 4,
    fontSize: 13,
  },
  errorBody: { color: "#FECACA", fontSize: 12, marginBottom: 10 },
  retryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#B91C1C",
  },
  retryText: { color: "#FEE2E2", fontSize: 12, fontWeight: "600" },

  heroCard: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 16,
  },
  heroRow: { flexDirection: "row", alignItems: "center" },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#F97316", fontSize: 18, fontWeight: "800" },

  heroName: { color: "#F9FAFB", fontSize: 20, fontWeight: "800" },
  heroMeta: { color: "#9CA3AF", fontSize: 12, marginTop: 4 },

  badgesRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  badge: {
    flex: 1,
    backgroundColor: "#0B1120",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#111827",
  },
  badgeLabel: { color: "#94A3B8", fontSize: 11 },
  badgeValue: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },

  ctaRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  ctaBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaPrimary: { backgroundColor: "#F97316" },
  ctaPrimaryText: { color: "#ffffff", fontWeight: "800", fontSize: 13 },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: "#4B5563",
    backgroundColor: "#020617",
  },
  ctaSecondaryText: { color: "#E5E7EB", fontWeight: "700", fontSize: 13 },
  ctaNote: { marginTop: 10, color: "#64748B", fontSize: 11 },

  section: { marginBottom: 18 },
  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSub: { color: "#94A3B8", fontSize: 12, marginBottom: 10 },
  sectionSubStrong: { color: "#E5E7EB", fontWeight: "800" },

  skillsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  skillChipText: { color: "#E5E7EB", fontSize: 12, fontWeight: "600" },

  availCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#020617",
    overflow: "hidden",
  },
  availRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  availRowBorder: { borderBottomWidth: 1, borderBottomColor: "#0B1120" },
  availDay: { color: "#E5E7EB", fontSize: 13, fontWeight: "700" },
  availTime: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },

  prefGrid: { flexDirection: "row", gap: 10 },
  prefBox: {
    flex: 1,
    backgroundColor: "#0B1120",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#111827",
  },
  prefLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  prefValue: { color: "#E5E7EB", fontSize: 12, fontWeight: "600" },

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
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyText: { color: "#64748B", fontSize: 12 },

  footer: { marginTop: 6 },
  footerHint: { color: "#64748B", fontSize: 11, marginBottom: 10 },
  footerBtn: {
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  footerBtnText: { color: "#E5E7EB", fontSize: 12, fontWeight: "700" },
});
