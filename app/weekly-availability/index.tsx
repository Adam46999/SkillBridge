// app/weekly-availability/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { AvailabilitySlot } from "../../lib/api";
import { getMe, updateProfile } from "../../lib/api";
import {
  getPendingWeeklyAvailability,
  getWeeklyLastSavedAt,
  markWeeklyAvailabilitySynced,
  setPendingWeeklyAvailability,
  clearPendingWeeklyAvailability,
} from "../../lib/availabilityStorage";
import SaveBar from "./SaveBar";
import TimeField from "./TimeField";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type ScheduleTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  slots: AvailabilitySlot[];
};

const scheduleTemplates: ScheduleTemplate[] = [
  {
    id: "weekday-evenings",
    name: "Weekday Evenings",
    description: "Mon-Fri, 7pm-9pm",
    icon: "🌆",
    slots: [
      { dayOfWeek: 1, from: "19:00", to: "21:00" },
      { dayOfWeek: 2, from: "19:00", to: "21:00" },
      { dayOfWeek: 3, from: "19:00", to: "21:00" },
      { dayOfWeek: 4, from: "19:00", to: "21:00" },
      { dayOfWeek: 5, from: "19:00", to: "21:00" },
    ],
  },
  {
    id: "weekend-mornings",
    name: "Weekend Mornings",
    description: "Sat-Sun, 9am-12pm",
    icon: "☕",
    slots: [
      { dayOfWeek: 0, from: "09:00", to: "12:00" },
      { dayOfWeek: 6, from: "09:00", to: "12:00" },
    ],
  },
  {
    id: "weekend-afternoons",
    name: "Weekend Afternoons",
    description: "Sat-Sun, 2pm-6pm",
    icon: "🌞",
    slots: [
      { dayOfWeek: 0, from: "14:00", to: "18:00" },
      { dayOfWeek: 6, from: "14:00", to: "18:00" },
    ],
  },
  {
    id: "flexible",
    name: "Flexible Hours",
    description: "Daily, 6pm-10pm",
    icon: "⏰",
    slots: [
      { dayOfWeek: 0, from: "18:00", to: "22:00" },
      { dayOfWeek: 1, from: "18:00", to: "22:00" },
      { dayOfWeek: 2, from: "18:00", to: "22:00" },
      { dayOfWeek: 3, from: "18:00", to: "22:00" },
      { dayOfWeek: 4, from: "18:00", to: "22:00" },
      { dayOfWeek: 5, from: "18:00", to: "22:00" },
      { dayOfWeek: 6, from: "18:00", to: "22:00" },
    ],
  },
];

function timeToMinutes(t: string) {
  const [h, m] = String(t || "0:0")
    .split(":")
    .map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function isValidSlot(s: AvailabilitySlot) {
  return timeToMinutes(s.to) > timeToMinutes(s.from);
}

function formatLastUpdated(ts: number | null): string {
  if (!ts) return "Not saved yet";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return new Date(ts).toLocaleDateString();
}

function normalizeSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  // clean + sort for stable comparisons
  const clean = (Array.isArray(slots) ? slots : [])
    .map((s) => ({
      dayOfWeek: Number((s as any)?.dayOfWeek ?? 0),
      from: String((s as any)?.from ?? "18:00"),
      to: String((s as any)?.to ?? "19:00"),
    }))
    .filter((s) => s.dayOfWeek >= 0 && s.dayOfWeek <= 6);

  clean.sort((a, b) => a.dayOfWeek - b.dayOfWeek || timeToMinutes(a.from) - timeToMinutes(b.from));
  return clean;
}

function slotsEqual(a: AvailabilitySlot[], b: AvailabilitySlot[]) {
  const A = normalizeSlots(a);
  const B = normalizeSlots(b);
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) {
    if (A[i].dayOfWeek !== B[i].dayOfWeek) return false;
    if (A[i].from !== B[i].from) return false;
    if (A[i].to !== B[i].to) return false;
  }
  return true;
}

export default function WeeklyAvailabilityScreen() {
  const router = useRouter();
  const mountedRef = useRef(true);

  const navigation = useNavigation();
  React.useEffect(() => {
    try {
      (navigation as any)?.setOptions?.({ headerShown: false });
    } catch {}
  }, [navigation]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [showTemplates, setShowTemplates] = useState(false);

  const [serverSlots, setServerSlots] = useState<AvailabilitySlot[]>([]);
  const [draftSlots, setDraftSlots] = useState<AvailabilitySlot[]>([]);

  const [restorePrompt, setRestorePrompt] = useState<null | {
    updatedAtISO: string;
    slots: AvailabilitySlot[];
  }>(null);

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const lastSavedText = useMemo(() => formatLastUpdated(lastSavedAt), [lastSavedAt]);

  const dirty = useMemo(() => !slotsEqual(serverSlots, draftSlots), [serverSlots, draftSlots]);

  const daySlots = useMemo(
    () => draftSlots.filter((s) => Number(s.dayOfWeek) === Number(selectedDay)),
    [draftSlots, selectedDay]
  );

  // Calculate stats for each day
  const dayStats = useMemo(() => {
    const stats = new Map<number, { count: number; totalMinutes: number }>();
    for (let i = 0; i <= 6; i++) {
      stats.set(i, { count: 0, totalMinutes: 0 });
    }
    
    draftSlots.forEach((slot) => {
      const stat = stats.get(slot.dayOfWeek)!;
      stat.count++;
      stat.totalMinutes += timeToMinutes(slot.to) - timeToMinutes(slot.from);
    });
    
    return stats;
  }, [draftSlots]);

  // Weekly totals
  const weeklyTotal = useMemo(() => {
    let total = 0;
    dayStats.forEach((stat) => {
      total += stat.totalMinutes;
    });
    return total;
  }, [dayStats]);

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        setLoading(true);

        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/(auth)/login");
          return;
        }

        const [me, pending, ts] = await Promise.all([
          getMe(token),
          getPendingWeeklyAvailability(),
          getWeeklyLastSavedAt(),
        ]);

        const userFromApi: any = (me as any)?.user ?? me;
        const slotsFromApi = normalizeSlots(userFromApi?.availabilitySlots ?? []);

        if (!mountedRef.current) return;

        setServerSlots(slotsFromApi);
        setDraftSlots(slotsFromApi);
        setLastSavedAt(ts);

        if (pending?.slots?.length) {
          const pendingSlots = normalizeSlots(pending.slots);
          // show restore only if it differs from server
          if (!slotsEqual(pendingSlots, slotsFromApi)) {
            setRestorePrompt({
              updatedAtISO: pending.updatedAtISO,
              slots: pendingSlots,
            });
          } else {
            // pending same as server -> cleanup
            await clearPendingWeeklyAvailability();
          }
        }
      } catch (e: any) {
        console.log("weekly availability load error:", e);
        Alert.alert(
          "Couldn’t load availability",
          e?.message || "Please try again."
        );
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [router]);

  // Auto store pending draft when user changes (simple, safe)
  useEffect(() => {
    if (loading) return;
    if (!dirty) return;
    setPendingWeeklyAvailability(draftSlots, "user-edit");
  }, [draftSlots, dirty, loading]);

  const addSlot = () => {
    setDraftSlots((prev) =>
      normalizeSlots([
        ...prev,
        { dayOfWeek: selectedDay, from: "18:00", to: "19:00" },
      ])
    );
  };

  const updateSlot = (idxInDay: number, patch: Partial<AvailabilitySlot>) => {
    // map daySlots index to actual index in draftSlots
    const target = daySlots[idxInDay];
    if (!target) return;

    setDraftSlots((prev) => {
      const next = prev.map((s) => {
        if (
          Number(s.dayOfWeek) === Number(target.dayOfWeek) &&
          s.from === target.from &&
          s.to === target.to
        ) {
          return { ...s, ...patch };
        }
        return s;
      });
      return normalizeSlots(next);
    });
  };

  const removeSlot = (idxInDay: number) => {
    const target = daySlots[idxInDay];
    if (!target) return;

    setDraftSlots((prev) => {
      const next = prev.filter(
        (s) =>
          !(
            Number(s.dayOfWeek) === Number(target.dayOfWeek) &&
            s.from === target.from &&
            s.to === target.to
          )
      );
      return normalizeSlots(next);
    });
  };

  const restorePending = async () => {
    if (!restorePrompt) return;
    setDraftSlots(restorePrompt.slots);
    setRestorePrompt(null);
  };

  const discardPending = async () => {
    setRestorePrompt(null);
    await clearPendingWeeklyAvailability();
  };

  const discardChanges = () => {
    setDraftSlots(serverSlots);
  };

  const applyTemplate = (template: ScheduleTemplate) => {
    if (Platform.OS === 'web') {
      // On web, use confirm instead of Alert.alert
      const confirmed = confirm(`Add "${template.name}" slots to your schedule?`);
      if (confirmed) {
        setDraftSlots((prev) => normalizeSlots([...prev, ...template.slots]));
        setShowTemplates(false);
      }
    } else {
      Alert.alert(
        "Add Template?",
        `Add "${template.name}" slots to your schedule?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add",
            onPress: () => {
              setDraftSlots((prev) => normalizeSlots([...prev, ...template.slots]));
              setShowTemplates(false);
            },
          },
        ]
      );
    }
  };

  const save = async () => {
    const invalid = draftSlots.some((s) => !isValidSlot(s));
    if (invalid) {
      Alert.alert(
        "Fix time slots",
        "Make sure every slot has From earlier than To."
      );
      return;
    }

    try {
      setSaving(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      await updateProfile(token, {
        availabilitySlots: normalizeSlots(draftSlots),
      } as any);

      if (!mountedRef.current) return;

      const normalized = normalizeSlots(draftSlots);
      setServerSlots(normalized);
      setDraftSlots(normalized);

      await markWeeklyAvailabilitySynced();
      const ts = await getWeeklyLastSavedAt();
      setLastSavedAt(ts);

      Alert.alert("Saved ✅", "Your weekly availability has been updated.");
    } catch (e: any) {
      console.log("weekly availability save error:", e);
      Alert.alert(
        "Save failed",
        e?.message || "Couldn’t save. Please try again."
      );
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ color: "#9CA3AF", marginTop: 12 }}>Loading availability…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={{ color: "#60A5FA", fontWeight: "900" }}>← Back</Text>
            </TouchableOpacity>

            <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "800" }}>
              Last saved: {lastSavedText}
            </Text>
          </View>

          <Text style={{ color: "#F9FAFB", fontSize: 22, fontWeight: "900", marginTop: 10 }}>
            Weekly availability
          </Text>
          <Text style={{ color: "#94A3B8", marginTop: 6, lineHeight: 18, fontSize: 12 }}>
            Add 1–2 time slots (evenings/weekend). Better mentor matches when your schedule is clear.
          </Text>

          {/* Restore pending banner */}
          {restorePrompt && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: "#0B1120",
                borderWidth: 1,
                borderColor: "#1E293B",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 13 }}>
                Restore unsaved changes?
              </Text>
              <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                Found a previous edit from {new Date(restorePrompt.updatedAtISO).toLocaleString()}.
              </Text>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={restorePending}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      backgroundColor: "#22C55E",
                      borderRadius: 999,
                      paddingVertical: 10,
                      alignItems: "center",
                    },
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                >
                  <Text style={{ color: "#022C22", fontWeight: "900" }}>Restore</Text>
                </Pressable>

                <Pressable
                  onPress={discardPending}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      backgroundColor: "#020617",
                      borderRadius: 999,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: "#334155",
                      alignItems: "center",
                    },
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                >
                  <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>Discard</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Templates button */}
          <Pressable
            onPress={() => setShowTemplates(!showTemplates)}
            style={({ pressed }) => [
              {
                marginTop: 16,
                backgroundColor: "#0B1120",
                borderWidth: 1,
                borderColor: "#1E293B",
                borderRadius: 12,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 20 }}>📅</Text>
              <View>
                <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 14 }}>
                  Quick Templates
                </Text>
                <Text style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>
                  Apply preset schedules
                </Text>
              </View>
            </View>
            <Text style={{ color: "#60A5FA", fontSize: 16, fontWeight: "900" }}>
              {showTemplates ? "▾" : "▸"}
            </Text>
          </Pressable>

          {/* Template cards */}
          {showTemplates && (
            <View style={{ marginTop: 12, gap: 10 }}>
              {scheduleTemplates.map((template) => (
                <Pressable
                  key={template.id}
                  onPress={() => applyTemplate(template)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: "#020617",
                      borderWidth: 1,
                      borderColor: "#1E293B",
                      borderRadius: 10,
                      padding: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    },
                    pressed ? { opacity: 0.85, backgroundColor: "#0B1120" } : null,
                  ]}
                >
                  <Text style={{ fontSize: 24 }}>{template.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 13 }}>
                      {template.name}
                    </Text>
                    <Text style={{ color: "#94A3B8", fontSize: 11, marginTop: 2 }}>
                      {template.description}
                    </Text>
                  </View>
                  <Text style={{ color: "#60A5FA", fontSize: 11, fontWeight: "900" }}>
                    Apply
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Weekly summary */}
          {weeklyTotal > 0 && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: "#0F172A",
                borderWidth: 1,
                borderColor: "#22C55E",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text style={{ color: "#86EFAC", fontWeight: "900", fontSize: 12, marginBottom: 8 }}>
                ✅ WEEKLY SUMMARY
              </Text>
              <Text style={{ color: "#E5E7EB", fontSize: 16, fontWeight: "900" }}>
                {Math.floor(weeklyTotal / 60)}h {weeklyTotal % 60}m total availability
              </Text>
              <Text style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>
                Across {draftSlots.length} time slot{draftSlots.length === 1 ? "" : "s"}
              </Text>
            </View>
          )}

          {/* Day selector */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "900", marginBottom: 10 }}>
              SELECT DAY
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {dayNames.map((d, idx) => {
                const active = idx === selectedDay;
                const stat = dayStats.get(idx)!;
                const hasSlots = stat.count > 0;

                return (
                  <Pressable
                    key={d}
                    onPress={() => setSelectedDay(idx)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        minWidth: 44,
                        paddingVertical: 12,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: active ? "#F97316" : hasSlots ? "#22C55E" : "#1E293B",
                        backgroundColor: active ? "#0B1120" : "#020617",
                        alignItems: "center",
                      },
                      pressed ? { opacity: 0.85 } : null,
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? "#FED7AA" : hasSlots ? "#86EFAC" : "#E5E7EB",
                        fontWeight: "900",
                        fontSize: 12,
                      }}
                    >
                      {d}
                    </Text>
                    {hasSlots && (
                      <View
                        style={{
                          marginTop: 4,
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: active ? "#F97316" : "#22C55E",
                        }}
                      />
                    )}
                    {stat.count > 0 && (
                      <Text
                        style={{
                          color: "#64748B",
                          fontSize: 9,
                          fontWeight: "900",
                          marginTop: 2,
                        }}
                      >
                        {stat.count}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Slots for selected day */}
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#F9FAFB", fontWeight: "900", fontSize: 14 }}>
                {dayNames[selectedDay]} slots
              </Text>

              <TouchableOpacity onPress={addSlot} activeOpacity={0.85}>
                <Text style={{ color: "#60A5FA", fontWeight: "900" }}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {daySlots.length === 0 ? (
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: "#111827",
                  borderRadius: 14,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
                <Text style={{ color: "#E5E7EB", fontWeight: "800", fontSize: 14, marginBottom: 4 }}>
                  No slots for {dayNames[selectedDay]}
                </Text>
                <Text style={{ color: "#64748B", fontSize: 12, lineHeight: 16, textAlign: "center" }}>
                  Tap "+ Add" to create your first time slot
                </Text>
                
                {/* Quick add suggestions */}
                <View style={{ marginTop: 12, gap: 8, width: "100%" }}>
                  <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "900", textAlign: "center" }}>
                    QUICK ADD
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { label: "Morning", from: "09:00", to: "12:00" },
                      { label: "Evening", from: "18:00", to: "21:00" },
                      { label: "Afternoon", from: "14:00", to: "17:00" },
                    ].map((quick) => (
                      <Pressable
                        key={quick.label}
                        onPress={() => {
                          setDraftSlots((prev) =>
                            normalizeSlots([
                              ...prev,
                              { dayOfWeek: selectedDay, from: quick.from, to: quick.to },
                            ])
                          );
                        }}
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: "#334155",
                            backgroundColor: "#0B1120",
                            alignItems: "center",
                          },
                          pressed ? { opacity: 0.85, backgroundColor: "#1E293B" } : null,
                        ]}
                      >
                        <Text style={{ color: "#94A3B8", fontSize: 10, fontWeight: "900" }}>
                          {quick.label}
                        </Text>
                        <Text style={{ color: "#E5E7EB", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                          {quick.from}-{quick.to}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 10, gap: 10 }}>
                {daySlots.map((slot, idx) => {
                  const ok = isValidSlot(slot);
                  const duration = ok ? timeToMinutes(slot.to) - timeToMinutes(slot.from) : 0;
                  const durationText = duration > 0 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : "";

                  return (
                    <View
                      key={`${slot.dayOfWeek}-${slot.from}-${slot.to}-${idx}`}
                      style={{
                        backgroundColor: "#0B1120",
                        borderWidth: 1.5,
                        borderColor: ok ? "#1E293B" : "#EF4444",
                        borderRadius: 14,
                        padding: 14,
                      }}
                    >
                      {/* Header */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: ok ? "#22C55E" : "#EF4444",
                            }}
                          />
                          <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 13 }}>
                            Slot #{idx + 1}
                          </Text>
                          {ok && durationText && (
                            <View
                              style={{
                                backgroundColor: "#134E4A",
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                              }}
                            >
                              <Text style={{ color: "#86EFAC", fontSize: 10, fontWeight: "900" }}>
                                {durationText}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Pressable
                          onPress={() => removeSlot(idx)}
                          style={({ pressed }) => [
                            {
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: "#EF4444",
                              backgroundColor: "#450A0A",
                            },
                            pressed ? { opacity: 0.85 } : null,
                          ]}
                        >
                          <Text style={{ color: "#FCA5A5", fontWeight: "900", fontSize: 11 }}>
                            × Remove
                          </Text>
                        </Pressable>
                      </View>

                      {/* Time inputs */}
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "900" }}>
                              FROM
                            </Text>
                            <View style={{ width: 16, height: 1, backgroundColor: "#334155" }} />
                          </View>
                          <TimeField
                            value={slot.from}
                            onChange={(v: string) => updateSlot(idx, { from: v })}
                          />
                        </View>

                        <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 20 }}>
                          <Text style={{ color: "#64748B", fontSize: 16, fontWeight: "900" }}>
                            →
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "900" }}>
                              TO
                            </Text>
                            <View style={{ width: 16, height: 1, backgroundColor: "#334155" }} />
                          </View>
                          <TimeField
                            value={slot.to}
                            onChange={(v: string) => updateSlot(idx, { to: v })}
                          />
                        </View>
                      </View>

                      {/* Error message */}
                      {!ok && (
                        <View
                          style={{
                            marginTop: 12,
                            backgroundColor: "#450A0A",
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: "#7F1D1D",
                          }}
                        >
                          <Text style={{ color: "#FCA5A5", fontWeight: "900", fontSize: 11 }}>
                            ⚠️ End time must be after start time
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Small reset button (non-intrusive) */}
          {dirty && (
            <Pressable
              onPress={discardChanges}
              style={({ pressed }) => [
                {
                  marginTop: 16,
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#334155",
                  backgroundColor: "#020617",
                },
                pressed ? { opacity: 0.9 } : null,
              ]}
            >
              <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
                Reset to last saved
              </Text>
            </Pressable>
          )}
        </ScrollView>

        <SaveBar
          visible={dirty}
          saving={saving}
          onSave={save}
          onDiscard={discardChanges}
          lastSavedText={lastSavedText}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

export const options = {
  title: "Weekly availability",
  headerTitle: "Weekly availability",
  headerShown: false,
};
