// app/find-mentor.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { MatchingMode } from "../lib/api";
import {
  AvailabilitySlot,
  MentorMatch,
  SkillLearn,
  getMe,
  getMentorMatches,
} from "../lib/api";

// ✅ chat: open conversation directly from results
import { getOrCreateConversation } from "../lib/chat/api";

type User = {
  _id: string;
  fullName: string;
  email: string;
  points: number;
  xp: number;
  streak: number;
  skillsToLearn?: SkillLearn[];
  availabilitySlots?: AvailabilitySlot[];
};

type LevelOption = "Beginner" | "Intermediate" | "Advanced";

const LEVELS: { value: LevelOption; label: string }[] = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

const MODES: { value: MatchingMode; label: string; hint: string }[] = [
  { value: "local", label: "Local", hint: "Fast, no API key needed" },
  { value: "openai", label: "OpenAI", hint: "Semantic embeddings (needs key)" },
  { value: "hybrid", label: "Hybrid", hint: "OpenAI → fallback to Local" },
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const options = {
  title: "Find a mentor",
  headerTitle: "Find a mentor",
  headerShown: false,
};

export default function FindMentorScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [customSkill, setCustomSkill] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<LevelOption>("Beginner");
  const [useMyAvailability, setUseMyAvailability] = useState<boolean>(true);
  const [mode, setMode] = useState<MatchingMode>("local");

  const [matches, setMatches] = useState<MentorMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // ---- Load current user ----
  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setErrorText(null);

        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/(auth)/login");
          return;
        }

        const data = (await getMe(token)) as any;
        const userFromApi: User = (data?.user ?? data) as User;

        if (!isMounted) return;

        setUser(userFromApi);

        const skills = userFromApi.skillsToLearn ?? [];
        if (skills.length > 0 && skills[0]?.name) {
          setSelectedSkill(skills[0].name);
        }
      } catch (err: any) {
        console.log("FindMentor / getMe error:", err);
        if (isMounted) {
          setErrorText(
            err?.message ||
              "We couldn’t load your profile. Please go back and try again."
          );
        }
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const learningSkills = useMemo(() => {
    const arr = user?.skillsToLearn ?? [];
    return arr
      .map((s) => ({
        name: String(s?.name || "").trim(),
        level: String((s as any)?.level || "Not specified").trim(),
      }))
      .filter((s) => !!s.name);
  }, [user?.skillsToLearn]);

  const availabilitySlots = useMemo(
    () => user?.availabilitySlots ?? [],
    [user?.availabilitySlots]
  );

  const effectiveSkill = useMemo(() => {
    if (customSkill.trim()) return customSkill.trim();
    return selectedSkill.trim();
  }, [customSkill, selectedSkill]);

  const canSearch = !!effectiveSkill && !loadingMatches && !loadingUser;

  const handleSearch = async () => {
    if (!canSearch) return;

    try {
      setErrorText(null);
      setLoadingMatches(true);
      setHasSearched(true);
      setMatches([]);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const payload = {
        skill: effectiveSkill,
        level: selectedLevel,
        availabilitySlots: useMyAvailability ? availabilitySlots : [],
        mode,
      };

      const res = await getMentorMatches(token, payload);
      setMatches(res.results ?? []);
    } catch (err: any) {
      console.log("getMentorMatches error:", err);
      setErrorText(
        err?.message ||
          "Something went wrong while searching for mentors. Please try again."
      );
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleBack = () => router.back();

  // Ensure header shows a friendly title (overrides file-name title)
  React.useEffect(() => {
    try {
      (navigation as any)?.setOptions?.({ headerTitle: "Find a mentor" });
    } catch {}
  }, [navigation]);

  // ✅ NEW: open mentor profile
  const openMentorProfile = (mentorId: string) => {
    router.push({ pathname: "/mentor/[id]", params: { id: mentorId } });
  };

  // ✅ NEW: open chat directly
  const openMentorChat = async (mentorId: string) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }

    const conversationId = await getOrCreateConversation(token, mentorId);

    // ✅ هذا هو الحل
    if (!conversationId || typeof conversationId !== "string") {
      console.warn("Invalid conversationId, aborting navigation");
      return;
    }

    router.push({
      pathname: "/(tabs)/chats/[conversationId]",
      params: { conversationId },
    });
  };

  const requestSession = (m: MentorMatch) => {
    router.push({
      pathname: "/sessions/request",
      params: {
        mentorId: m.mentorId,
        mentorName: m.fullName,
        skill: m.mainMatchedSkill?.name,
        level: m.mainMatchedSkill?.level,
      },
    });
  };

  if (loadingUser && !user && !errorText) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  const noLearningSkills = learningSkills.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} activeOpacity={0.85}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Find a mentor</Text>
        <Text style={styles.subtitle}>
          Pick a skill you want help with and we’ll look for people who can
          teach you.
        </Text>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
          </View>
        )}

        {/* 0. Matching mode */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>0. Matching mode</Text>
          <Text style={styles.sectionDescription}>
            Switch matching method with one tap (no code changes).
          </Text>

          <View style={styles.levelRow}>
            {MODES.map((opt) => {
              const active = mode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.levelChip, active && styles.levelChipActive]}
                  onPress={() => setMode(opt.value)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.levelChipText,
                      active && styles.levelChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.modeHint}>
            Current: <Text style={styles.modeHintStrong}>{mode}</Text> —{" "}
            {MODES.find((m) => m.value === mode)?.hint}
          </Text>
        </View>

        {/* 1. Skill selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Choose a skill</Text>
          <Text style={styles.sectionDescription}>
            Start with one of your learning goals, or type a custom skill.
          </Text>

          {noLearningSkills ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>No learning skills found</Text>
              <Text style={styles.infoBody}>
                You don’t have any learning goals yet. Go back to your dashboard
                and add some skills you want to learn.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>From your learning list</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {learningSkills.map((skillObj) => {
                  const active = selectedSkill === skillObj.name;
                  return (
                    <TouchableOpacity
                      key={skillObj.name}
                      onPress={() => setSelectedSkill(skillObj.name)}
                      style={[
                        styles.skillChip,
                        active && styles.skillChipActive,
                      ]}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.skillChipText,
                          active && styles.skillChipTextActive,
                        ]}
                      >
                        {skillObj.name}
                        {skillObj.level && skillObj.level !== "Not specified"
                          ? ` · ${skillObj.level}`
                          : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text style={[styles.label, { marginTop: 10 }]}>
            Or type a custom skill
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. React Native, Public speaking"
            placeholderTextColor="#6b7280"
            value={customSkill}
            onChangeText={setCustomSkill}
          />

          <View style={styles.currentSkillBox}>
            <Text style={styles.currentSkillLabel}>Current search skill:</Text>
            <Text style={styles.currentSkillValue}>
              {effectiveSkill || "Not selected yet"}
            </Text>
          </View>
        </View>

        {/* 2. Level selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Your level</Text>
          <Text style={styles.sectionDescription}>
            This helps us prioritize mentors who match your current experience.
          </Text>

          <View style={styles.levelRow}>
            {LEVELS.map((opt) => {
              const active = selectedLevel === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.levelChip, active && styles.levelChipActive]}
                  onPress={() => setSelectedLevel(opt.value)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.levelChipText,
                      active && styles.levelChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Availability usage */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Availability</Text>
          <Text style={styles.sectionDescription}>
            We can use your weekly availability to prioritize mentors who are
            free at similar times.
          </Text>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setUseMyAvailability((prev) => !prev)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.toggleOuter,
                useMyAvailability && styles.toggleOuterOn,
              ]}
            >
              <View
                style={[
                  styles.toggleInner,
                  useMyAvailability && styles.toggleInnerOn,
                ]}
              />
            </View>
            <Text style={styles.toggleLabel}>
              Use my weekly availability from dashboard
            </Text>
          </TouchableOpacity>

          {useMyAvailability && availabilitySlots.length > 0 && (
            <View style={styles.availabilityPreview}>
              {availabilitySlots.slice(0, 3).map((slot, idx) => (
                <Text key={idx} style={styles.availabilityLine}>
                  {dayNames[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}:{" "}
                  {slot.from} – {slot.to}
                </Text>
              ))}
              {availabilitySlots.length > 3 && (
                <Text style={styles.availabilityMore}>
                  + {availabilitySlots.length - 3} more…
                </Text>
              )}
            </View>
          )}

          {useMyAvailability && availabilitySlots.length === 0 && (
            <Text style={styles.noAvailabilityText}>
              You don’t have any availability set yet. You can still search for
              mentors, but results won’t be filtered by time.
            </Text>
          )}
        </View>

        {/* Search button */}
        <TouchableOpacity
          style={[
            styles.searchButton,
            (!canSearch || loadingMatches) && styles.searchButtonDisabled,
          ]}
          onPress={handleSearch}
          disabled={!canSearch}
          activeOpacity={0.85}
        >
          {loadingMatches ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.searchButtonText}>Search for mentors</Text>
          )}
        </TouchableOpacity>

        {/* Results */}
        <View style={styles.resultsSection}>
          <Text style={styles.resultsTitle}>Results</Text>

          {!hasSearched && (
            <Text style={styles.resultsHint}>
              Start by selecting a skill and tapping “Search for mentors”.
            </Text>
          )}

          {hasSearched && !loadingMatches && matches.length === 0 && (
            <Text style={styles.resultsHint}>
              No mentors found yet for this skill. Try another skill or relax
              your filters.
            </Text>
          )}

          {matches.map((m) => (
            <TouchableOpacity
              key={m.mentorId}
              activeOpacity={0.92}
              onPress={() => openMentorProfile(m.mentorId)}
              style={styles.matchCardClickable}
            >
              <View style={styles.matchHeaderRow}>
                <Text style={styles.matchName}>{m.fullName}</Text>
                <Text style={styles.matchScore}>
                  {Math.round(m.matchScore * 100)}%
                </Text>
              </View>

              {m.mainMatchedSkill && (
                <Text style={styles.matchSkillLine}>
                  Best match:{" "}
                  <Text style={styles.matchSkillHighlight}>
                    {m.mainMatchedSkill.name} ({m.mainMatchedSkill.level})
                  </Text>{" "}
                  · similarity{" "}
                  {Math.round(m.mainMatchedSkill.similarityScore * 100)}%
                </Text>
              )}

              {m.skillsToTeach && m.skillsToTeach.length > 0 && (
                <View style={styles.matchSkillsList}>
                  <Text style={styles.matchSkillsLabel}>Teaches:</Text>
                  <Text style={styles.matchSkillsValue}>
                    {m.skillsToTeach
                      .slice(0, 3)
                      .map((s) => s.name)
                      .join(", ")}
                    {m.skillsToTeach.length > 3
                      ? ` +${m.skillsToTeach.length - 3} more`
                      : ""}
                  </Text>
                </View>
              )}

              {m.availabilitySlots && m.availabilitySlots.length > 0 && (
                <Text style={styles.matchAvailability}>
                  Example availability:{" "}
                  {dayNames[m.availabilitySlots[0].dayOfWeek] ??
                    `Day ${m.availabilitySlots[0].dayOfWeek}`}{" "}
                  · {m.availabilitySlots[0].from} – {m.availabilitySlots[0].to}
                </Text>
              )}

              {/* actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionSecondary]}
                  activeOpacity={0.85}
                  onPress={() => openMentorProfile(m.mentorId)}
                >
                  <Text style={styles.actionSecondaryText}>View profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionPrimary]}
                  activeOpacity={0.85}
                  onPress={() => openMentorChat(m.mentorId)}
                >
                  <Text style={styles.actionPrimaryText}>Message</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.matchActionButton}
                activeOpacity={0.85}
                onPress={() => requestSession(m)}
              >
                <Text style={styles.matchActionText}>Request session</Text>
              </TouchableOpacity>

              <Text style={styles.tapHint}>
                Tip: tap anywhere on this card to open profile
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#9CA3AF",
    fontSize: 14,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    color: "#60A5FA",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F9FAFB",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    marginBottom: 14,
  },
  errorBox: {
    backgroundColor: "#451A1A",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 14,
  },
  errorTitle: {
    color: "#FECACA",
    fontWeight: "600",
    marginBottom: 4,
    fontSize: 13,
  },
  errorBody: {
    color: "#FECACA",
    fontSize: 12,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: "#CBD5F5",
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#020617",
  },
  skillChipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  skillChipText: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  skillChipTextActive: {
    color: "#F9FAFB",
    fontWeight: "600",
  },
  input: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    backgroundColor: "#020617",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#f9fafb",
  },
  currentSkillBox: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  currentSkillLabel: {
    color: "#94A3B8",
    fontSize: 11,
    marginBottom: 2,
  },
  currentSkillValue: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "500",
  },
  infoBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  infoTitle: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  infoBody: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  levelRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  levelChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#020617",
    alignItems: "center",
  },
  levelChipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  levelChipText: {
    color: "#E5E7EB",
    fontSize: 13,
  },
  levelChipTextActive: {
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  toggleOuter: {
    width: 38,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#6B7280",
    padding: 2,
    justifyContent: "center",
  },
  toggleOuterOn: {
    borderColor: "#22C55E",
    backgroundColor: "#022C22",
  },
  toggleInner: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#6B7280",
    alignSelf: "flex-start",
  },
  toggleInnerOn: {
    backgroundColor: "#22C55E",
    alignSelf: "flex-end",
  },
  toggleLabel: {
    marginLeft: 8,
    color: "#CBD5F5",
    fontSize: 12,
    flex: 1,
  },
  availabilityPreview: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#111827",
  },
  availabilityLine: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  availabilityMore: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 4,
  },
  noAvailabilityText: {
    marginTop: 8,
    color: "#9CA3AF",
    fontSize: 12,
  },
  searchButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F97316",
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  resultsSection: {
    marginTop: 18,
  },
  resultsTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  resultsHint: {
    color: "#9CA3AF",
    fontSize: 12,
  },

  // ✅ clickable card
  matchCardClickable: {
    marginTop: 10,
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
  },

  matchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  matchName: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "600",
  },
  matchScore: {
    color: "#F97316",
    fontSize: 14,
    fontWeight: "700",
  },
  matchSkillLine: {
    color: "#CBD5F5",
    fontSize: 12,
    marginTop: 4,
  },
  matchSkillHighlight: {
    color: "#FDE68A",
    fontWeight: "600",
  },
  matchSkillsList: {
    marginTop: 6,
  },
  matchSkillsLabel: {
    color: "#94A3B8",
    fontSize: 11,
  },
  matchSkillsValue: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  matchAvailability: {
    marginTop: 6,
    color: "#9CA3AF",
    fontSize: 11,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
  },
  actionPrimary: {
    backgroundColor: "#F97316",
    borderWidth: 1,
    borderColor: "#FB923C",
  },
  actionPrimaryText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: "#4B5563",
    backgroundColor: "#020617",
  },
  actionSecondaryText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
  },

  matchActionButton: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4B5563",
    backgroundColor: "#020617",
  },
  matchActionText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
  },

  tapHint: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 11,
  },

  modeHint: {
    marginTop: 10,
    color: "#9CA3AF",
    fontSize: 12,
  },
  modeHintStrong: {
    color: "#F9FAFB",
    fontWeight: "700",
  },
});
