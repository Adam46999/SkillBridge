import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const router = useRouter();

  const userName = "Kareem";
  const streak = 3;
  const xp = 120;
  const points = 45;

  const nextSession = {
    title: "Beginner Programming",
    time: "Today • 18:00",
    with: "with John",
  };

  const notificationsText = "You have 2 new teaching requests.";
  const isAvailable = true;

  // ====== HANDLERS ======

  const handleFindTeacher = () => {
    // نفتح تاب الـ Explore (بما إن عندك app/(tabs)/explore.tsx)
    router.push("/(tabs)/explore");
  };

  const handleSeeSessions = () => {
    // شاشة جديدة للجلسات: app/sessions.tsx (بننشئها بعد شوي)
    router.push("/sessions");
  };

  const handleAddLearningSkill = () => {
    // Go to manage skills screen
    router.push("/manage-skills");
  };

  const handleAddTeachingSkill = () => {
    // نفس الشاشة لإدارة skills
    router.push("/manage-skills");
  };

  const handleViewAllLearningSkills = () => {
    // برضه نفس الشاشة
    router.push("/manage-skills");
  };

  const handleViewAllTeachingSkills = () => {
    // برضه نفس الشاشة
    router.push("/manage-skills");
  };

  const handleSkillCardPress = (type: "teach" | "learn", name: string) => {
    Alert.alert(
      name,
      type === "teach"
        ? "Here you can see & manage requests for this skill."
        : "Here you can see your progress in this skill."
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View className="header" style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>

          {/* Status row */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isAvailable ? "#22C55E" : "#6B7280" },
              ]}
            />
            <Text style={styles.statusText}>
              {isAvailable ? "Available to teach & learn" : "Currently offline"}
            </Text>
          </View>
        </View>

        <View style={styles.pointsBox}>
          <Text style={styles.pointsLabel}>Points</Text>
          <Text style={styles.pointsValue}>{points}</Text>
        </View>
      </View>

      {/* Notifications */}
      <Text style={styles.notificationText}>{notificationsText}</Text>

      {/* Streak + XP */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Streak</Text>
          <Text style={styles.statValue}>{streak} days 🔥</Text>
          <Text style={styles.statHint}>
            Keep going! 4-day reward: +20 points
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>XP</Text>
          <Text style={styles.statValue}>{xp}</Text>
          <Text style={styles.statHint}>Closer to your next level</Text>
        </View>
      </View>

      {/* Next session */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next session</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.nextSessionCard}
          onPress={() => handleSkillCardPress("teach", nextSession.title)}
        >
          <Text style={styles.nextSessionTitle}>{nextSession.title}</Text>
          <Text style={styles.nextSessionSubtitle}>
            {nextSession.time} {nextSession.with}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Skills to Learn */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Skills you want to learn</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleAddLearningSkill}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSkillCardPress("learn", "React")}
          >
            <Text style={styles.chip}>React</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSkillCardPress("learn", "English Speaking")}
          >
            <Text style={styles.chip}>English Speaking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSkillCardPress("learn", "Algorithms")}
          >
            <Text style={styles.chip}>Algorithms</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.7} onPress={handleAddLearningSkill}>
          <Text style={styles.sectionLink}>Edit your learning skills →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleViewAllLearningSkills}
        >
          <Text style={styles.viewAllLink}>View all learning skills →</Text>
        </TouchableOpacity>
      </View>

      {/* Skills you can teach */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Skills you can teach</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleAddTeachingSkill}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.card}
          onPress={() => handleSkillCardPress("teach", "Beginner Programming")}
        >
          <Text style={styles.cardTitle}>Beginner Programming</Text>
          <Text style={styles.cardSubtitle}>
            You have 2 new requests waiting
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.card}
          onPress={() => handleSkillCardPress("teach", "High-school Math Help")}
        >
          <Text style={styles.cardTitle}>High-school Math Help</Text>
          <Text style={styles.cardSubtitle}>
            No active requests. Turn on availability.
          </Text>
        </TouchableOpacity>

        <Text style={styles.skillHint}>
          Sharing your skills helps you earn more points & XP.
        </Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleViewAllTeachingSkills}
        >
          <Text style={styles.viewAllLink}>View all teaching skills →</Text>
        </TouchableOpacity>
      </View>

      {/* Buttons */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.primaryButton}
          onPress={handleFindTeacher}
        >
          <Text style={styles.primaryButtonText}>Find someone to teach me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.secondaryButton}
          onPress={handleSeeSessions}
        >
          <Text style={styles.secondaryButtonText}>See my sessions</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

//
// ============= THEME STYLES =============
//

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#1C1917",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  welcomeText: {
    color: "#A8A29E",
    fontSize: 13,
  },

  userName: {
    color: "#FFFBEB",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 200,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
  },

  statusText: {
    color: "#E5E7EB",
    fontSize: 12,
  },

  pointsBox: {
    backgroundColor: "#292524",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "#F9731633",
  },

  pointsLabel: {
    color: "#D6D3D1",
    fontSize: 12,
  },

  pointsValue: {
    color: "#FACC15",
    fontSize: 20,
    fontWeight: "700",
  },

  notificationText: {
    color: "#FDE68A",
    fontSize: 13,
    marginBottom: 16,
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#292524",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F9731633",
  },

  statLabel: {
    color: "#D6D3D1",
    fontSize: 12,
    marginBottom: 6,
  },

  statValue: {
    color: "#FED7AA",
    fontSize: 17,
    fontWeight: "600",
  },

  statHint: {
    color: "#E5E7EB",
    fontSize: 11,
    marginTop: 4,
  },

  section: {
    marginBottom: 26,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#FFFBEB",
    fontSize: 17,
    fontWeight: "600",
  },

  addButtonText: {
    color: "#FDBA74",
    fontSize: 13,
    fontWeight: "500",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },

  chip: {
    backgroundColor: "#451A03",
    color: "#FED7AA",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    fontSize: 12,
  },

  sectionLink: {
    color: "#FDBA74",
    fontSize: 13,
    marginTop: 6,
  },

  viewAllLink: {
    color: "#FBBF24",
    fontSize: 13,
    marginTop: 4,
  },

  card: {
    backgroundColor: "#292524",
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FACC1533",
  },

  cardTitle: {
    color: "#FFFBEB",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },

  cardSubtitle: {
    color: "#E5E7EB",
    fontSize: 13,
  },

  nextSessionCard: {
    backgroundColor: "#292524",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F9731633",
  },

  nextSessionTitle: {
    color: "#FFFBEB",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },

  nextSessionSubtitle: {
    color: "#E5E7EB",
    fontSize: 13,
  },

  skillHint: {
    color: "#D1D5DB",
    fontSize: 12,
    marginTop: 4,
  },

  buttonsRow: {
    marginTop: 4,
    gap: 12,
    marginBottom: 10,
  },

  primaryButton: {
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#FFFBEB",
    fontWeight: "600",
    fontSize: 14,
  },

  secondaryButton: {
    borderColor: "#FACC15",
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#FDE68A",
    fontWeight: "500",
    fontSize: 14,
  },
});
