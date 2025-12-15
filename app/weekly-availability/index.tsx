// app/weekly-availability/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { AvailabilitySlot } from "../../lib/api";
import { DayAvailabilityCard, DaySelector, SaveBar } from "./components";
import { styles } from "./styles";
import TimeField from "./TimeField";
import { useWeeklyAvailability } from "./useWeeklyAvailability";

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ----- helpers -----
function normalizeTimeInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  // "18" -> 18:00
  if (/^\d{1,2}$/.test(t)) {
    const h = Number(t);
    if (h >= 0 && h < 24) return `${h.toString().padStart(2, "0")}:00`;
  }

  // "930" أو "1830" -> HH:MM
  if (/^\d{3,4}$/.test(t)) {
    const h = Number(t.slice(0, t.length - 2));
    const m = Number(t.slice(-2));
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${h.toString().padStart(2, "0")}:${m
        .toString()
        .padStart(2, "0")}`;
    }
  }

  // "18:30"
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) {
      return `${h.toString().padStart(2, "0")}:${min
        .toString()
        .padStart(2, "0")}`;
    }
  }

  return null;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((x) => Number(x));
  return h * 60 + m;
}

function minutesToHuman(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function minutesToHHMM(totalMin: number): string {
  const hh = Math.floor(totalMin / 60)
    .toString()
    .padStart(2, "0");
  const mm = (totalMin % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

// merge overlapping + adjacent slots for ONE day
function normalizeDaySlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const sorted = [...slots].sort(
    (a, b) => timeToMinutes(a.from) - timeToMinutes(b.from)
  );
  const out: AvailabilitySlot[] = [];

  for (const s of sorted) {
    if (!out.length) {
      out.push({ ...s });
      continue;
    }

    const last = out[out.length - 1];
    const lastEnd = timeToMinutes(last.to);
    const curStart = timeToMinutes(s.from);
    const curEnd = timeToMinutes(s.to);

    // overlap OR adjacent => merge
    if (curStart <= lastEnd) {
      const newEnd = Math.max(lastEnd, curEnd);
      last.to = minutesToHHMM(newEnd);
    } else {
      out.push({ ...s });
    }
  }

  return out;
}

function rangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string
): boolean {
  const aStart = timeToMinutes(aFrom);
  const aEnd = timeToMinutes(aTo);
  const bStart = timeToMinutes(bFrom);
  const bEnd = timeToMinutes(bTo);
  return aStart < bEnd && bStart < aEnd;
}

function buildQuickRangesForDay(dayIndex: number) {
  // Weekend (Fri=5, Sat=6)
  const isWeekend = dayIndex === 5 || dayIndex === 6; // Fri/Sat
  if (isWeekend) {
    return [
      { label: "10:00–14:00", from: "10:00", to: "14:00" },
      { label: "14:00–18:00", from: "14:00", to: "18:00" },
      { label: "18:00–20:00", from: "18:00", to: "20:00" },
    ];
  }

  // Weekdays
  return [
    { label: "18:00–20:00", from: "18:00", to: "20:00" },
    { label: "20:00–22:00", from: "20:00", to: "22:00" },
    { label: "10:00–14:00", from: "10:00", to: "14:00" },
  ];
}

// safe add slot to ONE day (prevents duplicates, then normalizes merges)
function addSlotToDay(
  prev: AvailabilitySlot[],
  day: number,
  from: string,
  to: string
) {
  const exists = prev.some(
    (s) => s.dayOfWeek === day && s.from === from && s.to === to
  );
  if (exists) return prev;

  // prevent overlaps (but allow adjacency; normalize merges it)
  const overlaps = prev.some(
    (s) => s.dayOfWeek === day && rangesOverlap(s.from, s.to, from, to)
  );
  if (overlaps) return prev;

  const next = [...prev, { dayOfWeek: day, from, to } as AvailabilitySlot];
  // normalize this day only
  const daySlots = normalizeDaySlots(next.filter((s) => s.dayOfWeek === day));
  const others = next.filter((s) => s.dayOfWeek !== day);
  return [...others, ...daySlots];
}

// replace day slots (copy)
function replaceDaySlots(
  prev: AvailabilitySlot[],
  targetDay: number,
  newSlotsForTargetDay: AvailabilitySlot[]
) {
  const others = prev.filter((s) => s.dayOfWeek !== targetDay);
  const normalized = normalizeDaySlots(
    newSlotsForTargetDay.map((s) => ({ ...s, dayOfWeek: targetDay }))
  );
  return [...others, ...normalized];
}

// total minutes for one day
function calcDayMinutes(slots: AvailabilitySlot[]): number {
  return slots.reduce((sum, s) => {
    const a = timeToMinutes(s.from);
    const b = timeToMinutes(s.to);
    return sum + Math.max(0, b - a);
  }, 0);
}

// lightweight toast (no libs)
function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const [text, setText] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const show = (msg: string) => {
    setText(msg);

    if (timerRef.current) clearTimeout(timerRef.current);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 10,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => setText(null));
    }, 1600);
  };

  return { text, opacity, translateY, show };
}

export default function WeeklyAvailabilityScreen() {
  const {
    user,
    availability,
    loading,
    saving,
    errorText,
    hasChanges,
    reload,
    save,
    updateAvailability,
    setErrorText,
  } = useWeeklyAvailability();

  const todayIndex = new Date().getDay(); // 0-6
  const scrollRef = useRef<ScrollView | null>(null);

  // toast
  const toast = useToast();

  const [selectedDay, setSelectedDay] = useState<number>(todayIndex);

  // inputs
  const [fromInput, setFromInput] = useState("18:00");
  const [toInput, setToInput] = useState("20:00");
  const [timeError, setTimeError] = useState<string | null>(null);

  // touched (to avoid showing validation too early)
  const [touchedFrom, setTouchedFrom] = useState(false);
  const [touchedTo, setTouchedTo] = useState(false);

  // editing slot
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);

  // multi-day add
  const [multiDays, setMultiDays] = useState<number[]>([]);

  // copy modal
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  // collapsed days (for readability)
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());

  const anyAvailability = availability.length > 0;

  // autoset collapsed when schedule exists (keep users focused)
  useEffect(() => {
    if (!anyAvailability) {
      setCollapsedDays(new Set()); // show all when empty state
      return;
    }

    // collapse empty days by default (keep user's toggles if already set)
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      for (let d = 0; d <= 6; d++) {
        const has = availability.some((s) => s.dayOfWeek === d);
        if (!has) next.add(d);
      }
      return next;
    });
  }, [anyAvailability, availability]);

  const quickRanges = useMemo(
    () => buildQuickRangesForDay(selectedDay),
    [selectedDay]
  );

  const groupedByDay = useMemo(() => {
    return DAY_NAMES_LONG.map((label, dayOfWeek) => {
      const slots = availability
        .filter((s) => s.dayOfWeek === dayOfWeek)
        .sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
      const normalizedSlots = normalizeDaySlots(slots);
      const minutes = calcDayMinutes(normalizedSlots);
      return { dayOfWeek, label, slots: normalizedSlots, minutes };
    });
  }, [availability]);

  // reorder: today first, then days with slots, then rest
  const orderedDays = useMemo(() => {
    const today = groupedByDay.find((d) => d.dayOfWeek === todayIndex);
    const withSlots = groupedByDay.filter(
      (d) => d.dayOfWeek !== todayIndex && d.slots.length > 0
    );
    const withoutSlots = groupedByDay.filter(
      (d) => d.dayOfWeek !== todayIndex && d.slots.length === 0
    );
    return [
      ...(today ? [today] : []),
      ...withSlots.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      ...withoutSlots.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    ];
  }, [groupedByDay, todayIndex]);

  const totalMinutesWeek = useMemo(() => {
    return groupedByDay.reduce((sum, d) => sum + d.minutes, 0);
  }, [groupedByDay]);

  const totalSlotsWeek = useMemo(() => availability.length, [availability]);

  const availabilityLevel = useMemo(() => {
    // text-only "progress feedback"
    if (totalMinutesWeek >= 600) return { label: "🟢 Excellent availability" }; // 10h+
    if (totalMinutesWeek >= 240) return { label: "🟡 Good availability" }; // 4h+
    if (totalMinutesWeek > 0) return { label: "🔴 Low availability" };
    return { label: "Start by adding 1–2 slots" };
  }, [totalMinutesWeek]);

  if (loading && !user && !errorText) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your availability…</Text>
      </View>
    );
  }

  const normalizedFrom = normalizeTimeInput(fromInput);
  const normalizedTo = normalizeTimeInput(toInput);

  const canAdd =
    !!normalizedFrom &&
    !!normalizedTo &&
    timeToMinutes(normalizedFrom) < timeToMinutes(normalizedTo);

  const shouldShowBasicValidation =
    (touchedFrom || touchedTo) && (!normalizedFrom || !normalizedTo || !canAdd);

  const handleQuickRangePress = (from: string, to: string) => {
    setFromInput(from);
    setToInput(to);
    setTimeError(null);
    setTouchedFrom(true);
    setTouchedTo(true);
  };

  const clearEditing = () => {
    setEditingSlot(null);
    setTimeError(null);
  };

  const handleAddSlot = () => {
    const nFrom = normalizeTimeInput(fromInput);
    const nTo = normalizeTimeInput(toInput);

    if (!nFrom || !nTo) {
      setTimeError('Please use a valid time like "18", "1830" or "18:30".');
      return;
    }

    const fromMin = timeToMinutes(nFrom);
    const toMin = timeToMinutes(nTo);
    if (fromMin >= toMin) {
      setTimeError("Start time must be before end time.");
      return;
    }

    const targetDays = multiDays.length ? multiDays : [selectedDay];

    let changed = false;
    updateAvailability((prev) => {
      let next = prev;

      for (const day of targetDays) {
        const beforeLen = next.length;
        next = addSlotToDay(next, day, nFrom, nTo);
        if (next.length !== beforeLen) changed = true;
      }

      return next;
    });

    if (!changed) {
      setTimeError("That slot already exists or overlaps an existing one.");
      return;
    }

    setFromInput(nFrom);
    setToInput(nTo);
    setTimeError(null);
    clearEditing();
    toast.show("Slot added ✅");
  };

  const handleRemoveSlot = (slot: AvailabilitySlot) => {
    updateAvailability((prev) =>
      prev.filter(
        (s) =>
          !(
            s.dayOfWeek === slot.dayOfWeek &&
            s.from === slot.from &&
            s.to === slot.to
          )
      )
    );

    if (
      editingSlot &&
      editingSlot.dayOfWeek === slot.dayOfWeek &&
      editingSlot.from === slot.from &&
      editingSlot.to === slot.to
    ) {
      clearEditing();
    }

    toast.show("Slot removed");
  };

  const handleEditSlot = (slot: AvailabilitySlot) => {
    setSelectedDay(slot.dayOfWeek);
    setFromInput(slot.from);
    setToInput(slot.to);
    setTimeError(null);
    setEditingSlot(slot);
    setTouchedFrom(true);
    setTouchedTo(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleUpdateEditing = () => {
    if (!editingSlot) return;

    const nFrom = normalizeTimeInput(fromInput);
    const nTo = normalizeTimeInput(toInput);

    if (!nFrom || !nTo) {
      setTimeError('Please use a valid time like "18", "1830" or "18:30".');
      return;
    }

    const fromMin = timeToMinutes(nFrom);
    const toMin = timeToMinutes(nTo);
    if (fromMin >= toMin) {
      setTimeError("Start time must be before end time.");
      return;
    }

    const day = editingSlot.dayOfWeek;

    let overlapBlocked = false;

    updateAvailability((prev) => {
      // remove old
      let next = prev.filter(
        (s) =>
          !(
            s.dayOfWeek === editingSlot.dayOfWeek &&
            s.from === editingSlot.from &&
            s.to === editingSlot.to
          )
      );

      // ensure no overlap with others
      const overlaps = next.some(
        (s) => s.dayOfWeek === day && rangesOverlap(s.from, s.to, nFrom, nTo)
      );
      if (overlaps) {
        overlapBlocked = true;
        return prev;
      }

      next = addSlotToDay(next, day, nFrom, nTo);
      return next;
    });

    if (overlapBlocked) {
      setTimeError("That edit overlaps an existing slot.");
      return;
    }

    setEditingSlot({ dayOfWeek: day, from: nFrom, to: nTo });
    setTimeError(null);
    toast.show("Slot updated ✨");
  };

  const handleClearDay = (dayIndex: number) => {
    updateAvailability((prev) => prev.filter((s) => s.dayOfWeek !== dayIndex));
    if (editingSlot?.dayOfWeek === dayIndex) clearEditing();
    toast.show("Day cleared");
  };

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      setErrorText(null);
      toast.show("Saved ✅");
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      "Discard changes?",
      "This will revert your availability to the last saved version.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            clearEditing();
            setMultiDays([]);
            setTouchedFrom(false);
            setTouchedTo(false);
            reload();
            toast.show("Changes discarded");
          },
        },
      ]
    );
  };

  // --------- Empty state presets ----------
  const applyWeekdayEvenings = () => {
    updateAvailability((prev) => {
      let next = prev;
      // Mon-Thu = 1..4
      for (const day of [1, 2, 3, 4]) {
        next = addSlotToDay(next, day, "18:00", "20:00");
        next = addSlotToDay(next, day, "20:00", "22:00");
      }
      return next;
    });
    setTimeError(null);
    toast.show("Weekday evenings added");
  };

  const applyWeekendMornings = () => {
    updateAvailability((prev) => {
      let next = prev;
      // Fri/Sat
      for (const day of [5, 6]) {
        next = addSlotToDay(next, day, "10:00", "14:00");
      }
      return next;
    });
    setTimeError(null);
    toast.show("Weekend mornings added");
  };

  // --------- Copy day ----------
  const openCopyModal = (fromDay: number) => {
    setCopyFromDay(fromDay);
    setCopyTargets([]);
    setCopyOpen(true);
  };

  const toggleCopyTarget = (d: number) => {
    setCopyTargets((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      return [...prev, d];
    });
  };

  const confirmCopy = () => {
    if (copyFromDay === null) return;
    if (!copyTargets.length) {
      Alert.alert("Pick days", "Choose at least one target day to copy into.");
      return;
    }

    const sourceSlots = availability.filter((s) => s.dayOfWeek === copyFromDay);
    const normalizedSource = normalizeDaySlots(sourceSlots);

    updateAvailability((prev) => {
      let next = prev;

      for (const targetDay of copyTargets) {
        next = replaceDaySlots(next, targetDay, normalizedSource);
      }

      return next;
    });

    setCopyOpen(false);
    setCopyFromDay(null);
    setCopyTargets([]);
    toast.show("Copied ✅");
  };

  // Multi-day selection
  const toggleMultiDay = (d: number) => {
    setMultiDays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      return [...prev, d];
    });
  };

  const clearMultiDays = () => setMultiDays([]);

  const selectWeekdays = () => {
    setMultiDays([1, 2, 3, 4]); // Mon-Thu
  };

  const toggleCollapsed = (dayIndex: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  };

  // dynamic title/subtitle
  const headerTitle = anyAvailability
    ? "Edit your weekly availability"
    : "Set your weekly availability";
  const headerSubtitle =
    "Pick a day, add time ranges, then review your week. More availability = better mentor matches.";

  // quick preset active check
  const isQuickActive = (from: string, to: string) => {
    const nFrom = normalizeTimeInput(fromInput);
    const nTo = normalizeTimeInput(toInput);
    if (!nFrom || !nTo) return false;
    return nFrom === from && nTo === to;
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
        }}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* (A) Header */}
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.subtitle}>{headerSubtitle}</Text>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your weekly summary</Text>
          <Text style={styles.summaryText}>
            {availabilityLevel.label} · Total:{" "}
            {minutesToHuman(totalMinutesWeek)} · {totalSlotsWeek} slot
            {totalSlotsWeek === 1 ? "" : "s"}
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                Tip: evenings + weekend = best matches
              </Text>
            </View>
            {!anyAvailability && (
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>
                  Start with presets below
                </Text>
              </View>
            )}
          </View>
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>We couldn’t load your profile</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
            <Text
              style={[
                styles.errorBody,
                { textDecorationLine: "underline", marginBottom: 0 },
              ]}
              onPress={reload}
            >
              Tap here to try again.
            </Text>
          </View>
        )}

        {/* (B) Day selector */}
        <Text style={styles.sectionTitle}>1) Choose a day</Text>
        <Text style={styles.sectionHint}>
          Tap a day, then add one or more time ranges below.
        </Text>

        <DaySelector
          selectedDay={selectedDay}
          onSelect={(d) => {
            setSelectedDay(d);
            setTimeError(null);
            if (editingSlot && editingSlot.dayOfWeek !== d)
              setEditingSlot(null);
          }}
          dayNames={DAY_NAMES_SHORT}
          todayIndex={todayIndex}
        />

        {/* (C) Time input */}
        <Text style={styles.sectionTitle}>2) Add your time ranges</Text>
        <Text style={styles.sectionHint}>
          Tip: type 18 → 18:00, 1830 → 18:30, or pick from the time picker.
        </Text>

        <View
          style={[
            styles.timeCard,
            editingSlot ? styles.timeCardEditing : styles.timeCardNormal,
          ]}
        >
          <View style={styles.timeLabelRow}>
            <Text style={styles.timeLabel}>
              {editingSlot ? "Edit time range ✏️" : "Add a time range ⏰"}
            </Text>
            <Text style={styles.timeSelectedDayText}>
              Selected: {DAY_NAMES_LONG[selectedDay]}
            </Text>
          </View>

          <View style={styles.timeRow}>
            <TimeField
              label="From"
              value={fromInput}
              onChange={(t) => {
                setFromInput(t);
                setTimeError(null);
                setTouchedFrom(true);
              }}
            />
            <Text style={styles.timeDash}>–</Text>
            <TimeField
              label="To"
              value={toInput}
              onChange={(t) => {
                setToInput(t);
                setTimeError(null);
                setTouchedTo(true);
              }}
            />
          </View>

          {/* Presets */}
          <View style={styles.quickRow}>
            {quickRanges.map((r) => {
              const active = isQuickActive(r.from, r.to);
              return (
                <TouchableOpacity
                  key={r.label}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                  onPress={() => handleQuickRangePress(r.from, r.to)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      active && styles.quickChipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Multi-day add */}
          <View style={styles.multiRow}>
            <View style={styles.multiTopRow}>
              <Text style={styles.multiTitle}>Apply to multiple days</Text>

              <View style={styles.multiTopActions}>
                <TouchableOpacity
                  style={styles.miniActionBtn}
                  onPress={selectWeekdays}
                  activeOpacity={0.85}
                >
                  <Text style={styles.miniActionText}>Select weekdays</Text>
                </TouchableOpacity>

                {multiDays.length > 0 && (
                  <TouchableOpacity
                    style={styles.miniActionBtn}
                    onPress={clearMultiDays}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.miniActionText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={styles.multiCountText}>
              {multiDays.length
                ? `Applying to ${multiDays.length} day${
                    multiDays.length === 1 ? "" : "s"
                  }`
                : "Optional: select days, or leave empty to apply to selected day only."}
            </Text>

            <View style={styles.multiDaysRow}>
              {DAY_NAMES_SHORT.map((d, idx) => {
                const active = multiDays.includes(idx);
                return (
                  <TouchableOpacity
                    key={`${d}-${idx}`}
                    style={[
                      styles.multiDayChip,
                      active && styles.multiDayChipActive,
                    ]}
                    onPress={() => toggleMultiDay(idx)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.multiDayChipText}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Validation (only after touch) */}
          {shouldShowBasicValidation && (
            <Text style={styles.timeErrorText}>
              Please enter a valid time range (start must be before end).
            </Text>
          )}
          {timeError && <Text style={styles.timeErrorText}>{timeError}</Text>}

          {/* Primary button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!canAdd || saving) && styles.primaryButtonDisabled,
            ]}
            onPress={() => {
              if (editingSlot) handleUpdateEditing();
              else handleAddSlot();
            }}
            activeOpacity={0.85}
            disabled={!canAdd || saving}
          >
            <Text style={styles.primaryText}>
              {editingSlot ? "Save edit" : "Add slot"}
            </Text>
          </TouchableOpacity>

          {/* Editing banner */}
          {editingSlot && (
            <View style={styles.editBanner}>
              <Text style={styles.editBannerTitle}>Editing</Text>
              <Text style={styles.editBannerSub}>
                {DAY_NAMES_LONG[editingSlot.dayOfWeek]} · {editingSlot.from} –{" "}
                {editingSlot.to}
              </Text>

              <View style={styles.editBannerRow}>
                <TouchableOpacity
                  style={styles.bannerBtn}
                  onPress={clearEditing}
                  activeOpacity={0.85}
                >
                  <Text style={styles.bannerBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bannerBtn, styles.bannerDanger]}
                  onPress={() => handleRemoveSlot(editingSlot)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.bannerBtnText, styles.bannerDangerText]}>
                    Delete
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bannerBtn, styles.bannerPrimary]}
                  onPress={handleUpdateEditing}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.bannerBtnText, styles.bannerPrimaryText]}
                  >
                    Save edit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Secondary actions */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setFromInput("18:00");
                setToInput("20:00");
                setTimeError(null);
                toast.show("Reset to evening");
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Reset to evening</Text>
            </TouchableOpacity>

            {multiDays.length > 0 && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={clearMultiDays}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>Clear multi-days</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Empty state smart presets */}
        {!anyAvailability && (
          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>Start fast</Text>
            <Text style={styles.timeHint}>
              One tap presets to build a good weekly schedule.
            </Text>

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={applyWeekdayEvenings}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>
                  Add weekday evenings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={applyWeekendMornings}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>
                  Add weekend mornings
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* (D) Review */}
        <Text style={styles.sectionTitle}>3) Review your week</Text>
        <Text style={styles.sectionHint}>
          Tap a slot to edit ✏️ · Use Copy 📋 to duplicate a day · Clear 🗑 to
          reset a day.
        </Text>

        {orderedDays.map(({ dayOfWeek, label, slots, minutes }) => (
          <DayAvailabilityCard
            key={label}
            dayIndex={dayOfWeek}
            dayLabel={label}
            slots={slots}
            onRemoveSlot={handleRemoveSlot}
            onEditSlot={handleEditSlot}
            onClearDay={handleClearDay}
            onCopyDay={openCopyModal}
            totalMinutesForDay={minutes}
            collapsed={collapsedDays.has(dayOfWeek)}
            onToggleCollapsed={toggleCollapsed}
          />
        ))}
      </ScrollView>

      {/* Copy modal */}
      <Modal
        visible={copyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCopyOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Copy day availability</Text>

            <Text style={styles.copyHint}>
              Copy from{" "}
              <Text style={{ fontWeight: "900", color: "#F9FAFB" }}>
                {copyFromDay === null ? "-" : DAY_NAMES_LONG[copyFromDay]}
              </Text>{" "}
              into:
            </Text>

            <View style={styles.copyList}>
              {DAY_NAMES_SHORT.map((d, idx) => {
                const disabled = idx === copyFromDay;
                const active = copyTargets.includes(idx);

                return (
                  <TouchableOpacity
                    key={`${d}-${idx}`}
                    style={[
                      styles.copyChip,
                      active && styles.copyChipActive,
                      disabled && { opacity: 0.5 },
                    ]}
                    onPress={() => {
                      if (disabled) return;
                      toggleCopyTarget(idx);
                    }}
                    activeOpacity={0.85}
                    disabled={disabled}
                  >
                    <Text style={styles.copyChipText}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.copyHint}>
              Note: target day will be{" "}
              <Text style={{ fontWeight: "900", color: "#F9FAFB" }}>
                replaced
              </Text>{" "}
              with the copied schedule (clean & consistent).
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity onPress={() => setCopyOpen(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={confirmCopy}>
                <Text style={styles.modalDone}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticky SaveBar */}
      <SaveBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* Toast overlay */}
      {toast.text && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            {
              opacity: toast.opacity,
              transform: [{ translateY: toast.translateY }],
            },
          ]}
        >
          <View style={styles.toastCard}>
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
