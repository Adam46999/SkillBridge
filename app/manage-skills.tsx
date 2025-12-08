// app/manage-skills.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AvailabilitySlot, SkillTeach, getMe, updateProfile } from "../lib/api";

type User = {
  _id: string;
  fullName: string;
  email: string;
  skillsToLearn?: string[];
  skillsToTeach?: SkillTeach[];
  availabilitySlots?: AvailabilitySlot[];
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;
type LevelOption = (typeof LEVEL_OPTIONS)[number];

type SkillNode = {
  id: string;
  label: string;
  children?: SkillNode[];
};

// 🌲 شجرة مهارات بسيطة
const SKILL_TREE: SkillNode[] = [
  {
    id: "prog",
    label: "Programming",
    children: [
      {
        id: "web",
        label: "Web development",
        children: [
          { id: "react", label: "React" },
          { id: "node", label: "Node.js basics" },
          { id: "htmlcss", label: "HTML & CSS" },
        ],
      },
      {
        id: "mobile",
        label: "Mobile apps",
        children: [
          { id: "reactnative", label: "React Native basics" },
          { id: "expo", label: "Expo / RN setup" },
        ],
      },
      {
        id: "csfund",
        label: "CS fundamentals",
        children: [
          { id: "algos", label: "Algorithms basics" },
          { id: "ds", label: "Data structures basics" },
        ],
      },
    ],
  },
  {
    id: "lang",
    label: "Languages",
    children: [
      {
        id: "english",
        label: "English",
        children: [
          { id: "eng-speaking", label: "English speaking" },
          { id: "eng-writing", label: "English writing" },
        ],
      },
      {
        id: "hebrew",
        label: "Hebrew",
        children: [{ id: "hebrew-speaking", label: "Hebrew speaking" }],
      },
    ],
  },
  {
    id: "school",
    label: "School support",
    children: [
      {
        id: "math",
        label: "Math",
        children: [
          { id: "hs-math", label: "High-school math help" },
          { id: "uni-math", label: "University math basics" },
        ],
      },
      {
        id: "cs-course",
        label: "Intro CS courses",
        children: [
          { id: "intro-prog", label: "Intro programming help" },
          { id: "exam-prep", label: "Exam preparation help" },
        ],
      },
    ],
  },
];

function sortAvailability(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return [...slots].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.from.localeCompare(b.from);
  });
}

function parseTimeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
}

type UndoState = null | {
  type: "learning" | "teaching" | "availability";
  item: any;
  index: number;
};

export default function ManageSkillsScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [learningSkills, setLearningSkills] = useState<string[]>([]);
  const [teachingSkills, setTeachingSkills] = useState<SkillTeach[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  const [newLearning, setNewLearning] = useState("");
  const [newTeachName, setNewTeachName] = useState("");
  const [newTeachLevel, setNewTeachLevel] = useState<LevelOption>("Beginner");

  const [newDay, setNewDay] = useState("Mon");
  const [newFrom, setNewFrom] = useState("18:00");
  const [newTo, setNewTo] = useState("19:00");

  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState>(null);

  // لاختيار من الشجرة
  const [selectedCategory, setSelectedCategory] = useState<SkillNode | null>(
    null
  );
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<SkillNode | null>(null);
  const [selectedSkillNode, setSelectedSkillNode] = useState<SkillNode | null>(
    null
  );

  const markChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setErrorText(null);

      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        router.replace("/login" as any);
        return;
      }

      const data = (await getMe(token)) as unknown as User;

      setUser(data);
      setLearningSkills(data.skillsToLearn || []);
      setTeachingSkills(data.skillsToTeach || []);
      setAvailability(sortAvailability(data.availabilitySlots || []));
      setHasChanges(false);
      setSaveMessage(null);
      setUndoState(null);
    } catch (err: any) {
      console.log("manage-skills / load error:", err);
      setErrorText(
        err?.message || "We couldn’t load your profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // ⚠️ تحذير قبل الخروج لو في تغييرات غير محفوظة
  useEffect(() => {
    if (!hasChanges) return;

    const sub = navigation.addListener("beforeRemove", (e: any) => {
      if (!hasChanges) return;
      e.preventDefault();

      Alert.alert(
        "Unsaved changes",
        "You have unsaved changes. What would you like to do?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              setHasChanges(false);
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: "Save",
            onPress: async () => {
              try {
                await handleSave();
                navigation.dispatch(e.data.action);
              } catch {
                // handleSave already shows error
              }
            },
          },
        ]
      );
    });

    return sub;
  }, [navigation, hasChanges]); // intentionally بدون handleSave لتجنب لوب

  // ---------- Learning skills ----------

  const handleAddLearning = () => {
    const trimmed = newLearning.trim();
    if (!trimmed) return;
    if (learningSkills.includes(trimmed)) {
      Alert.alert("Already added", "You already added this learning goal.");
      return;
    }
    setLearningSkills((prev) => [...prev, trimmed]);
    setNewLearning("");
    setUndoState(null);
    markChanged();
  };

  const handleRemoveLearning = (skill: string) => {
    const index = learningSkills.indexOf(skill);
    if (index === -1) return;
    const removed = learningSkills[index];

    setLearningSkills((prev) => prev.filter((s) => s !== skill));
    setUndoState({
      type: "learning",
      item: removed,
      index,
    });
    markChanged();
  };

  // ---------- Teaching skills ----------

  const handleCategoryPress = (node: SkillNode) => {
    setSelectedCategory(node);
    setSelectedSubcategory(null);
    setSelectedSkillNode(null);
    setNewTeachName("");
  };

  const handleSubcategoryPress = (node: SkillNode) => {
    setSelectedSubcategory(node);
    setSelectedSkillNode(null);
    setNewTeachName("");
  };

  const handleSkillPick = (node: SkillNode) => {
    setSelectedSkillNode(node);
    setNewTeachName(node.label);
  };

  const handleAddTeaching = () => {
    const name = newTeachName.trim();
    const level = (newTeachLevel || "Beginner") as LevelOption;

    if (!name) {
      Alert.alert(
        "Missing skill name",
        "Please pick a skill from the list or type a custom skill name."
      );
      return;
    }

    const newSkill: SkillTeach = {
      name,
      level: level || "Not specified",
    };

    setTeachingSkills((prev) => [...prev, newSkill]);
    setNewTeachName("");
    setSelectedSkillNode(null);
    setUndoState(null);
    markChanged();
  };

  const handleRemoveTeaching = (index: number) => {
    if (index < 0 || index >= teachingSkills.length) return;
    const removed = teachingSkills[index];

    setTeachingSkills((prev) => prev.filter((_, i) => i !== index));
    setUndoState({
      type: "teaching",
      item: removed,
      index,
    });
    markChanged();
  };

  function getTeachingTag(skill: SkillTeach): string {
    const name = skill.name.toLowerCase();
    if (name.includes("exam") || name.includes("test")) {
      return "Exam help";
    }
    if (name.includes("speaking")) {
      return "Conversation";
    }
    if (skill.level === "Beginner") return "Beginner-friendly";
    if (skill.level === "Advanced") return "Advanced";
    return "General";
  }

  // ---------- Availability ----------

  const handleAddAvailability = () => {
    const trimmedDay = newDay.trim();
    const dayIndex = dayNames.indexOf(trimmedDay);
    if (dayIndex === -1) {
      Alert.alert(
        "Invalid day",
        'Please enter a valid day like "Mon", "Tue", "Wed"...'
      );
      return;
    }
    if (!newFrom.trim() || !newTo.trim()) {
      Alert.alert("Missing time", "Please fill both From and To times.");
      return;
    }

    const fromMin = parseTimeToMinutes(newFrom.trim());
    const toMin = parseTimeToMinutes(newTo.trim());

    if (fromMin === null || toMin === null) {
      Alert.alert("Invalid time", 'Use HH:MM format like "18:00" or "09:30".');
      return;
    }

    if (fromMin >= toMin) {
      Alert.alert(
        "Invalid range",
        "The start time must be before the end time."
      );
      return;
    }

    const exists = availability.some(
      (slot) =>
        slot.dayOfWeek === dayIndex &&
        slot.from === newFrom.trim() &&
        slot.to === newTo.trim()
    );
    if (exists) {
      Alert.alert(
        "Already added",
        "This exact time slot already exists in your availability."
      );
      return;
    }

    const newSlot: AvailabilitySlot = {
      dayOfWeek: dayIndex,
      from: newFrom.trim(),
      to: newTo.trim(),
    };

    setAvailability((prev) => sortAvailability([...prev, newSlot]));
    setUndoState(null);
    markChanged();
  };

  const handleRemoveAvailability = (index: number) => {
    if (index < 0 || index >= availability.length) return;
    const removed = availability[index];

    setAvailability((prev) => prev.filter((_, i) => i !== index));
    setUndoState({
      type: "availability",
      item: removed,
      index,
    });
    markChanged();
  };

  // 🧩 Templates بسيطة (3)
  const applyAvailabilityTemplate = (kind: "evening" | "weekend") => {
    let newSlots: AvailabilitySlot[] = [];

    if (kind === "evening") {
      // Mon–Thu 18:00–21:00
      [1, 2, 3, 4].forEach((day) => {
        newSlots.push({
          dayOfWeek: day,
          from: "18:00",
          to: "21:00",
        });
      });
    } else {
      // Sat–Sun 10:00–14:00 (Sun=0, Sat=6)
      [0, 6].forEach((day) => {
        newSlots.push({
          dayOfWeek: day,
          from: "10:00",
          to: "14:00",
        });
      });
    }

    // دمج بدون تكرار
    const merged = [...availability];
    newSlots.forEach((slot) => {
      const exists = merged.some(
        (s) =>
          s.dayOfWeek === slot.dayOfWeek &&
          s.from === slot.from &&
          s.to === slot.to
      );
      if (!exists) merged.push(slot);
    });

    setAvailability(sortAvailability(merged));
    setUndoState(null);
    markChanged();
  };

  // 🔙 Undo
  const handleUndo = () => {
    if (!undoState) return;

    if (undoState.type === "learning") {
      const copy = [...learningSkills];
      copy.splice(undoState.index, 0, undoState.item as string);
      setLearningSkills(copy);
    } else if (undoState.type === "teaching") {
      const copy = [...teachingSkills];
      copy.splice(undoState.index, 0, undoState.item as SkillTeach);
      setTeachingSkills(copy);
    } else if (undoState.type === "availability") {
      const copy = [...availability];
      copy.splice(undoState.index, 0, undoState.item as AvailabilitySlot);
      setAvailability(sortAvailability(copy));
    }

    setUndoState(null);
    markChanged();
  };

  // ---------- Save ----------

  const handleSave = async () => {
    if (saving || !hasChanges) return;

    try {
      setSaving(true);
      setSaveMessage(null);

      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        router.replace("/login" as any);
        return;
      }

      const payload = {
        skillsToLearn: learningSkills,
        skillsToTeach: teachingSkills,
        availabilitySlots: availability,
      };

      const updated = await updateProfile(token, payload);
      setUser(updated as unknown as User);
      setHasChanges(false);
      setSaveMessage("Your changes have been saved.");
      setUndoState(null);

      setTimeout(() => {
        setSaveMessage(null);
      }, 2000);
    } catch (err: any) {
      console.log("manage-skills / save error:", err);
      Alert.alert(
        "Couldn’t save",
        err?.message || "Something went wrong while saving your changes."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && !user) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Manage your skills & availability</Text>
            <Text style={styles.subtitle}>
              Set what you want to learn, what you can teach, and when you’re
              usually available.
            </Text>
          </View>
          {hasChanges ? (
            <View style={styles.badgeUnsaved}>
              <Text style={styles.badgeUnsavedText}>Unsaved</Text>
            </View>
          ) : (
            <View style={styles.badgeSaved}>
              <Text style={styles.badgeSavedText}>All saved</Text>
            </View>
          )}
        </View>

        {saveMessage && (
          <View style={styles.saveToast}>
            <Text style={styles.saveToastText}>{saveMessage}</Text>
          </View>
        )}

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>We couldn’t load your profile</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Learning skills */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Skills you want to learn</Text>
          <Text style={styles.sectionHint}>
            Add a few learning goals so SkillSwap can match you with the right
            people.
          </Text>

          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Type a skill (e.g. React, English speaking…)"
              placeholderTextColor="#6B7280"
              value={newLearning}
              onChangeText={(v) => {
                setNewLearning(v);
                markChanged();
              }}
              returnKeyType="done"
              onSubmitEditing={handleAddLearning}
            />
            <TouchableOpacity
              style={[
                styles.smallPrimaryButton,
                !newLearning.trim() && styles.smallButtonDisabled,
              ]}
              onPress={handleAddLearning}
              disabled={!newLearning.trim()}
            >
              <Text style={styles.smallPrimaryText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chipContainer}>
            {learningSkills.length === 0 && (
              <Text style={styles.emptyText}>
                You haven’t added any learning goals yet.
              </Text>
            )}
            {learningSkills.map((skill) => (
              <TouchableOpacity
                key={skill}
                style={styles.chip}
                onPress={() => handleRemoveLearning(skill)}
              >
                <Text style={styles.chipText}>{skill}</Text>
                <Text style={styles.chipX}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Teaching skills */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Skills you can teach</Text>
          <Text style={styles.sectionHint}>
            Pick a category and skill, or type a custom one. Choose the level
            instead of writing it.
          </Text>

          {/* Category */}
          <Text style={styles.labelSmall}>Step 1 · Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowChips}
          >
            {SKILL_TREE.map((cat) => {
              const selected = selectedCategory?.id === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    selected && styles.filterChipSelected,
                  ]}
                  onPress={() => handleCategoryPress(cat)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Subcategory */}
          {selectedCategory && selectedCategory.children && (
            <>
              <Text style={styles.labelSmall}>Step 2 · Subcategory</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowChips}
              >
                {selectedCategory.children.map((sub) => {
                  const selected = selectedSubcategory?.id === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.filterChip,
                        selected && styles.filterChipSelected,
                      ]}
                      onPress={() => handleSubcategoryPress(sub)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selected && styles.filterChipTextSelected,
                        ]}
                      >
                        {sub.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Skill */}
          {selectedSubcategory && selectedSubcategory.children && (
            <>
              <Text style={styles.labelSmall}>Step 3 · Skill</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowChips}
              >
                {selectedSubcategory.children.map((skillNode) => {
                  const selected = selectedSkillNode?.id === skillNode.id;
                  return (
                    <TouchableOpacity
                      key={skillNode.id}
                      style={[
                        styles.filterChip,
                        selected && styles.filterChipSelectedStrong,
                      ]}
                      onPress={() => handleSkillPick(skillNode)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selected && styles.filterChipTextSelectedStrong,
                        ]}
                      >
                        {skillNode.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Custom skill */}
          <Text style={[styles.labelSmall, { marginTop: 10 }]}>
            Or type a custom skill
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Custom skill (if not listed above)"
            placeholderTextColor="#6B7280"
            value={newTeachName}
            onChangeText={(text) => {
              setNewTeachName(text);
              setSelectedSkillNode(null);
              markChanged();
            }}
            returnKeyType="done"
            onSubmitEditing={handleAddTeaching}
          />

          {/* Level selector */}
          <Text style={[styles.labelSmall, { marginTop: 10 }]}>
            Level (for this teaching skill)
          </Text>
          <View style={styles.rowChips}>
            {LEVEL_OPTIONS.map((lvl) => {
              const selected = newTeachLevel === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.levelPill,
                    selected && styles.levelPillSelected,
                  ]}
                  onPress={() => {
                    setNewTeachLevel(lvl);
                    markChanged();
                  }}
                >
                  <Text
                    style={[
                      styles.levelPillText,
                      selected && styles.levelPillTextSelected,
                    ]}
                  >
                    {lvl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !newTeachName.trim() && styles.buttonDisabled,
            ]}
            onPress={handleAddTeaching}
            disabled={!newTeachName.trim()}
          >
            <Text style={styles.primaryText}>Add teaching skill</Text>
          </TouchableOpacity>

          {teachingSkills.length === 0 ? (
            <Text style={[styles.emptyText, { marginTop: 8 }]}>
              You haven’t added any teaching skills yet.
            </Text>
          ) : (
            teachingSkills.map((skill, index) => (
              <View key={`${skill.name}-${index}`} style={styles.teachCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teachName}>{skill.name}</Text>
                  <Text style={styles.teachLevel}>
                    Level: {skill.level} • {getTeachingTag(skill)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveTeaching(index)}
                >
                  <Text style={styles.deleteText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Availability */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Weekly availability</Text>
          <Text style={styles.sectionHint}>
            Add a few time slots when you’re usually free for SkillSwap
            sessions.
          </Text>

          {/* Templates (3) */}
          <View style={styles.templateRow}>
            <TouchableOpacity
              style={styles.templateButton}
              onPress={() => applyAvailabilityTemplate("evening")}
            >
              <Text style={styles.templateTitle}>Evening template</Text>
              <Text style={styles.templateText}>Mon–Thu · 18:00–21:00</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.templateButton}
              onPress={() => applyAvailabilityTemplate("weekend")}
            >
              <Text style={styles.templateTitle}>Weekend template</Text>
              <Text style={styles.templateText}>Sat–Sun · 10:00–14:00</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newDay}
              onChangeText={(v) => {
                setNewDay(v);
                markChanged();
              }}
              placeholder='Day (e.g. "Mon")'
              placeholderTextColor="#6B7280"
              returnKeyType="next"
            />
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newFrom}
              onChangeText={(v) => {
                setNewFrom(v);
                markChanged();
              }}
              placeholder="From (e.g. 18:00)"
              placeholderTextColor="#6B7280"
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
              value={newTo}
              onChangeText={(v) => {
                setNewTo(v);
                markChanged();
              }}
              placeholder="To (e.g. 19:00)"
              placeholderTextColor="#6B7280"
              returnKeyType="done"
              onSubmitEditing={handleAddAvailability}
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAddAvailability}
          >
            <Text style={styles.primaryText}>Add availability slot</Text>
          </TouchableOpacity>

          {availability.length === 0 ? (
            <Text style={[styles.emptyText, { marginTop: 8 }]}>
              You haven’t added any availability yet.
            </Text>
          ) : (
            availability.map((slot, index) => (
              <View key={index} style={styles.availabilityRow}>
                <Text style={styles.availabilityText}>
                  {dayNames[slot.dayOfWeek] || "Day"} • {slot.from} – {slot.to}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemoveAvailability(index)}
                >
                  <Text style={styles.deleteText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Undo bar */}
        {undoState && (
          <View style={styles.undoBar}>
            <Text style={styles.undoText}>
              Removed{" "}
              {undoState.type === "learning"
                ? "learning goal"
                : undoState.type === "teaching"
                ? "teaching skill"
                : "time slot"}
              .
            </Text>
            <TouchableOpacity onPress={handleUndo}>
              <Text style={styles.undoLink}>Undo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save row */}
        <View style={styles.saveRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.saveHint}>
              {hasChanges
                ? "You have unsaved changes."
                : "All your changes are saved."}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (saving || !hasChanges) && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.saveText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#9CA3AF", marginTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
  },

  badgeUnsaved: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#451A03",
    borderWidth: 1,
    borderColor: "#FDBA74",
    marginLeft: 8,
    marginTop: 2,
  },
  badgeUnsavedText: {
    color: "#FED7AA",
    fontSize: 11,
    fontWeight: "600",
  },
  badgeSaved: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#022C22",
    borderWidth: 1,
    borderColor: "#22C55E",
    marginLeft: 8,
    marginTop: 2,
  },
  badgeSavedText: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: "600",
  },

  saveToast: {
    backgroundColor: "#022C22",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#16A34A",
    marginBottom: 10,
  },
  saveToastText: {
    color: "#BBF7D0",
    fontSize: 12,
  },

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

  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 16,
  },

  sectionTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionHint: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#F9FAFB",
    fontSize: 13,
  },

  smallPrimaryButton: {
    marginLeft: 8,
    backgroundColor: "#F97316",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  smallPrimaryText: {
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 12,
  },
  smallButtonDisabled: {
    opacity: 0.5,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  chipText: { color: "#E5E7EB", fontSize: 12, marginRight: 4 },
  chipX: { color: "#9CA3AF", fontSize: 12 },

  primaryButton: {
    marginTop: 8,
    backgroundColor: "#F97316",
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryText: {
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 12,
  },

  teachCard: {
    marginTop: 10,
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teachName: { color: "#F9FAFB", fontSize: 14, fontWeight: "600" },
  teachLevel: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },

  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  deleteText: { color: "#E5E7EB", fontSize: 12 },

  availabilityRow: {
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  availabilityText: {
    color: "#E5E7EB",
    fontSize: 13,
  },

  templateRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  templateButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  templateTitle: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
  templateText: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },

  rowChips: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    marginBottom: 4,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  filterChipSelected: {
    backgroundColor: "#0F172A",
    borderColor: "#F97316",
  },
  filterChipSelectedStrong: {
    backgroundColor: "#F97316",
    borderColor: "#FDBA74",
  },
  filterChipText: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: "#FED7AA",
  },
  filterChipTextSelectedStrong: {
    color: "#0F172A",
    fontWeight: "600",
  },

  labelSmall: {
    color: "#9CA3AF",
    fontSize: 11,
    marginBottom: 4,
    marginTop: 4,
  },

  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
    marginRight: 6,
  },
  levelPillSelected: {
    backgroundColor: "#F97316",
    borderColor: "#FDBA74",
  },
  levelPillText: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  levelPillTextSelected: {
    color: "#0F172A",
    fontWeight: "600",
  },

  undoBar: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoText: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  undoLink: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "600",
  },

  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  saveHint: {
    color: "#6B7280",
    fontSize: 12,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    minWidth: 130,
  },
  saveText: {
    color: "#022C22",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
});
