// app/weekly-availability/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDay, setSelectedDay] = useState<number>(0);

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

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        setLoading(true);

        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/(auth)/login" as any);
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
        router.replace("/(auth)/login" as any);
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

          {/* Day selector */}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {dayNames.map((d, idx) => {
              const active = idx === selectedDay;
              return (
                <Pressable
                  key={d}
                  onPress={() => setSelectedDay(idx)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "#F97316" : "#1E293B",
                      backgroundColor: active ? "#0B1120" : "#020617",
                    },
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                >
                  <Text style={{ color: active ? "#FED7AA" : "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
                    {d}
                  </Text>
                </Pressable>
              );
            })}
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
                  padding: 12,
                }}
              >
                <Text style={{ color: "#E5E7EB", fontWeight: "800" }}>No slots yet</Text>
                <Text style={{ color: "#64748B", marginTop: 4, fontSize: 12, lineHeight: 16 }}>
                  Tap “Add” to create your first slot for this day.
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 10, gap: 10 }}>
                {daySlots.map((slot, idx) => {
                  const ok = isValidSlot(slot);
                  return (
                    <View
                      key={`${slot.dayOfWeek}-${slot.from}-${slot.to}-${idx}`}
                      style={{
                        backgroundColor: "#0B1120",
                        borderWidth: 1,
                        borderColor: ok ? "#1E293B" : "#FCA5A5",
                        borderRadius: 14,
                        padding: 12,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>
                          Slot #{idx + 1} {ok ? "" : " (Fix time)"}
                        </Text>

                        <Pressable
                          onPress={() => removeSlot(idx)}
                          style={({ pressed }) => [
                            {
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: "#334155",
                              backgroundColor: "#020617",
                            },
                            pressed ? { opacity: 0.85 } : null,
                          ]}
                        >
                          <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>Remove</Text>
                        </Pressable>
                      </View>

                      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "900", marginBottom: 6 }}>
                            From
                          </Text>
                          <TimeField
                            value={slot.from}
                            onChange={(v: string) => updateSlot(idx, { from: v })}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "900", marginBottom: 6 }}>
                            To
                          </Text>
                          <TimeField
                            value={slot.to}
                            onChange={(v: string) => updateSlot(idx, { to: v })}
                          />
                        </View>
                      </View>

                      {!ok && (
                        <Text style={{ color: "#FCA5A5", marginTop: 10, fontWeight: "900", fontSize: 12 }}>
                          “To” must be later than “From”.
                        </Text>
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
