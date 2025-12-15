// app/screens/homescreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getMe } from "../../lib/api";

// ===== Types =====
type AvailabilitySlot = {
  dayOfWeek: number; // 0-6
  from: string;
  to: string;
};

type SkillTeach = {
  name: string;
  level: string;
};

// ✅ FIX: server returns objects [{name, level}]
type SkillLearn = {
  name: string;
  level: string;
};

type User = {
  _id: string;
  fullName: string;
  email: string;
  points: number;
  xp: number;
  streak: number;

  // ✅ FIX here
  skillsToLearn?: SkillLearn[];
  skillsToTeach?: SkillTeach[];
  availabilitySlots?: AvailabilitySlot[];
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getInitials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getLevelFromXp(xp: number | undefined) {
  const val = xp ?? 0;
  const level = Math.floor(val / 100);
  const progress = val % 100;
  return { level, progress };
}

export default function HomeScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    try {
      setErrorText(null);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const me: any = await getMe(token);
      const userFromApi: User = (me?.user ?? me) as User;

      setUser(userFromApi);
    } catch (err: any) {
      console.log("Home / getMe error:", err);
      setErrorText(
        err?.message || "We couldn’t load your profile. Please pull to refresh."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadUser();
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    router.replace("/login");
  };

  const handleFindMentor = () => {
    router.push("/find-mentor");
  };

  const handleOfferSession = () => {
    // لاحقاً
  };

  if (loading && !user && !errorText) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  const { level, progress } = getLevelFromXp(user?.xp);
  const streak = user?.streak ?? 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
                {user?.fullName || "SkillSwap learner"}
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
                <Text style={styles.progressValue}>
                  {progress}/100 XP to next level
                </Text>
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
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>We couldn’t refresh your data</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadUser}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===== Stats row ===== */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>XP</Text>
            <Text style={styles.statValue}>{user?.xp ?? 0}</Text>
            <Text style={styles.statHint}>Earned by learning from others</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Points</Text>
            <Text style={styles.statValue}>{user?.points ?? 0}</Text>
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
            >
              <Text style={styles.quickEmoji}>🧑‍🏫</Text>
              <Text style={styles.quickTitle}>Find a mentor</Text>
              <Text style={styles.quickText}>
                Discover people who can help you with your learning goals.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickCard, styles.quickSecondary]}
              onPress={handleOfferSession}
            >
              <Text style={styles.quickEmoji}>🤝</Text>
              <Text style={styles.quickTitle}>Offer a session</Text>
              <Text style={styles.quickText}>
                Share a skill you’re confident about and help someone else.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== Skills you want to learn ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Skills you want to learn</Text>

            <Link href="/manage-skills-to-learn" asChild>
              <TouchableOpacity>
                <Text style={styles.sectionAction}>Manage</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {user?.skillsToLearn && user.skillsToLearn.length > 0 ? (
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
            </View>
          )}
        </View>

        {/* ===== Skills you can teach ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Skills you can teach</Text>

            <Link href="/manage-skills-to-teach" asChild>
              <TouchableOpacity>
                <Text style={styles.sectionAction}>Manage</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {user?.skillsToTeach && user.skillsToTeach.length > 0 ? (
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
            </View>
          )}
        </View>

        {/* ===== Availability ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your weekly availability</Text>

            <Link href="/weekly-availability" asChild>
              <TouchableOpacity>
                <Text style={styles.sectionAction}>Edit</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {user?.availabilitySlots && user.availabilitySlots.length > 0 ? (
            <View style={styles.availabilityList}>
              {user.availabilitySlots.map((slot, idx) => (
                <View key={idx} style={styles.availabilityRow}>
                  <Text style={styles.availabilityDay}>
                    {dayNames[slot.dayOfWeek] || "Day"}
                  </Text>
                  <Text style={styles.availabilityTime}>
                    {slot.from} – {slot.to}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No availability set</Text>
              <Text style={styles.emptyText}>
                Let others know when you’re usually free. You can add evening or
                weekend slots that work for you.
              </Text>
            </View>
          )}
        </View>

        {/* ===== Footer ===== */}
        <View style={styles.footerRow}>
          <Text style={styles.footerHint}>Last updated just now</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ===== Styles =====
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
    marginBottom: 18,
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
