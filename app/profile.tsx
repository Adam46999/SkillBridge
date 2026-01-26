// app/profile.tsx
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

import type { AvailabilitySlot, SkillLearn, SkillTeach } from "../lib/api";
import { getMe } from "../lib/api";

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

// dayNames not needed here

export const options = {
  title: "Profile",
  headerTitle: "Profile",
  headerShown: true,
};

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

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const goLogin = useCallback(() => {
    router.replace("/(auth)/login");
  }, [router]);

  const loadUser = useCallback(async () => {
    try {
      setErrorText(null);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        goLogin();
        return;
      }

      const me: any = await getMe(token);
      const userFromApi: User = (me?.user ?? me) as User;

      if (!mountedRef.current) return;
      setUser(userFromApi);
    } catch (err: any) {
      console.log("Profile / getMe error:", err);
      if (!mountedRef.current) return;
      setErrorText(err?.message || "Couldn’t load your profile.");
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [goLogin]);

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

  const slots = useMemo(() => user?.availabilitySlots ?? [], [user?.availabilitySlots]);
  const totalMin = useMemo(() => calcTotalMinutes(slots), [slots]);
  const daysSet = useMemo(() => new Set(slots.map((s) => s.dayOfWeek)).size, [slots]);

  if (loading && !user && !errorText) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/(tabs)")}
          activeOpacity={0.85}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>

        <View style={styles.headerCard}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.name}>{user?.fullName || "SkillSwap user"}</Text>
          <Text style={styles.email}>{user?.email || "—"}</Text>

          <View style={styles.headerStatsRow}>
            <View style={styles.headerStat}>
              <Text style={styles.statLabel}>XP</Text>
              <Text style={styles.statValue}>{user?.xp ?? 0}</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.statLabel}>Points</Text>
              <Text style={styles.statValue}>{user?.points ?? 0}</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.statLabel}>Streak</Text>
              <Text style={styles.statValue}>{user?.streak ?? 0}</Text>
            </View>
          </View>
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn’t refresh</Text>
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

        {/* ✅ One place to manage everything (no bouncing) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage</Text>
          <Text style={styles.sectionSubtitle}>
            Update what matters without jumping around too much.
          </Text>

          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/manage-skills-to-learn")}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Skills to learn</Text>
              <Text style={styles.rowSub}>
                {(user?.skillsToLearn?.length ?? 0) > 0
                  ? `${user?.skillsToLearn?.length} goal(s)`
                  : "Not set yet"}
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/manage-skills-to-teach")}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Skills to teach</Text>
              <Text style={styles.rowSub}>
                {(user?.skillsToTeach?.length ?? 0) > 0
                  ? `${user?.skillsToTeach?.length} skill(s)`
                  : "Not set yet"}
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/weekly-availability")}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Weekly availability</Text>
              <Text style={styles.rowSub}>
                {slots.length
                  ? `${daysSet} day(s) · ${minutesToHuman(totalMin)} total`
                  : "Not set yet"}
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/manage-preferences")}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Preferences</Text>
              <Text style={styles.rowSub}>
                Languages & communication modes
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/find-mentor")}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Find mentor</Text>
              <Text style={styles.rowSub}>Get matched instantly</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
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

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  backButtonText: {
    color: "#60A5FA",
    fontSize: 14,
    fontWeight: "600",
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, color: "#9CA3AF", fontSize: 14 },

  headerCard: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 12,
  },
  title: { color: "#9CA3AF", fontSize: 13 },
  name: { color: "#F9FAFB", fontSize: 22, fontWeight: "700", marginTop: 6 },
  email: { color: "#64748B", fontSize: 12, marginTop: 4 },

  headerStatsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  headerStat: {
    flex: 1,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statLabel: { color: "#94A3B8", fontSize: 11, marginBottom: 4 },
  statValue: { color: "#F9FAFB", fontSize: 18, fontWeight: "700" },

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

  section: { marginTop: 8, marginBottom: 20 },
  sectionTitle: { color: "#F9FAFB", fontSize: 16, fontWeight: "600" },
  sectionSubtitle: { color: "#64748B", fontSize: 12, marginTop: 4 },

  rowBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  rowTitle: { color: "#F9FAFB", fontSize: 14, fontWeight: "600" },
  rowSub: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  rowArrow: { color: "#60A5FA", fontSize: 22, marginLeft: 10 },

  footerRow: { marginTop: 8, alignItems: "flex-start" },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  logoutText: { color: "#E5E7EB", fontSize: 12, fontWeight: "600" },
});
