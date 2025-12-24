// app/weekly-availability/components.tsx
import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { AvailabilitySlot } from "../../lib/api";
import { styles } from "./styles";

type DaySelectorProps = {
  selectedDay: number;
  onSelect: (dayIndex: number) => void;
  onLongPressDay?: (dayIndex: number) => void;
  dayNames: string[]; // ["Sun".."Sat"]
  todayIndex: number;
};

export const DaySelector: React.FC<DaySelectorProps> = ({
  selectedDay,
  onSelect,
  onLongPressDay,
  dayNames,
  todayIndex,
}) => {
  return (
    <View style={styles.daySelectorRow}>
      {dayNames.map((d, idx) => {
        const isSelected = idx === selectedDay;
        const isToday = idx === todayIndex;

        return (
          <TouchableOpacity
            key={`${d}-${idx}`}
            style={[
              styles.dayChip,
              isToday && styles.dayChipToday,
              isSelected && styles.dayChipSelected,
            ]}
            onPress={() => onSelect(idx)}
            onLongPress={() => onLongPressDay?.(idx)}
            delayLongPress={250}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Select ${d}`}
          >
            <Text
              style={[
                styles.dayChipText,
                isToday && styles.dayChipTextToday,
                isSelected && styles.dayChipTextSelected,
              ]}
            >
              {d}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ====================== Day Card ======================

type DayAvailabilityCardProps = {
  dayIndex: number;
  dayLabel: string;
  slots: AvailabilitySlot[];
  totalMinutesForDay: number;

  collapsed: boolean;
  onToggleCollapsed: (dayIndex: number) => void;

  onRemoveSlot: (slot: AvailabilitySlot) => void;
  onEditSlot: (slot: AvailabilitySlot) => void;
  onClearDay: (dayIndex: number) => void;

  onCopyDay: (dayIndex: number) => void;

  onQuickAdd?: (dayIndex: number, from: string, to: string) => void;

  highlightSlotKey?: string | null; // `${from}-${to}`
};

function minutesToHuman(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const DayAvailabilityCard: React.FC<DayAvailabilityCardProps> = ({
  dayIndex,
  dayLabel,
  slots,
  totalMinutesForDay,
  collapsed,
  onToggleCollapsed,
  onRemoveSlot,
  onEditSlot,
  onClearDay,
  onCopyDay,
  onQuickAdd,
  highlightSlotKey,
}) => {
  const dayHasSlots = slots.length > 0;

  const daySub = useMemo(() => {
    if (!dayHasSlots) return "No slots yet";
    return `${slots.length} slot${
      slots.length === 1 ? "" : "s"
    } · ${minutesToHuman(totalMinutesForDay)}`;
  }, [dayHasSlots, slots.length, totalMinutesForDay]);

  const showQuickForEmpty = !dayHasSlots;

  return (
    <View style={styles.dayCard}>
      {/* Header */}
      <View style={styles.dayHeaderRow}>
        <TouchableOpacity
          onPress={() => onToggleCollapsed(dayIndex)}
          activeOpacity={0.85}
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={`Toggle ${dayLabel}`}
        >
          <Text style={styles.dayName}>
            {dayLabel}{" "}
            <Text style={{ color: "#64748B", fontSize: 12, fontWeight: "900" }}>
              {collapsed ? "▸" : "▾"}
            </Text>
          </Text>
          <Text style={styles.daySubText}>{daySub}</Text>
        </TouchableOpacity>

        <View style={styles.dayHeaderActions}>
          {dayHasSlots ? (
            <>
              <TouchableOpacity
                onPress={() => onCopyDay(dayIndex)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.copyDayText}>Copy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onClearDay(dayIndex)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.clearDayText}>Clear</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => onCopyDay(dayIndex)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.copyDayText}>Copy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onClearDay(dayIndex)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.clearDayText}>Clear</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Body */}
      {collapsed ? (
        <Text style={styles.daySlotsEmptyText}>
          {dayHasSlots ? "Collapsed" : "Collapsed (empty)"}
        </Text>
      ) : (
        <>
          {/* Empty state quick actions */}
          {showQuickForEmpty && onQuickAdd && (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.daySlotsEmptyText}>
                Add something quick to get started:
              </Text>

              <View style={styles.quickRow}>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => onQuickAdd(dayIndex, "18:00", "20:00")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickChipText}>18:00–20:00</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => onQuickAdd(dayIndex, "20:00", "22:00")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickChipText}>20:00–22:00</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => onQuickAdd(dayIndex, "10:00", "14:00")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickChipText}>10:00–14:00</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Slots */}
          {dayHasSlots ? (
            <View style={[styles.slotChipRow, { marginTop: 10 }]}>
              {slots.map((slot, idx) => {
                const key = `${slot.from}-${slot.to}`;
                const isHighlight = highlightSlotKey === key;

                return (
                  <TouchableOpacity
                    key={`${slot.dayOfWeek}-${slot.from}-${slot.to}-${idx}`}
                    style={[
                      styles.slotChip,
                      isHighlight && {
                        borderColor: "#60A5FA",
                        backgroundColor: "#0B1120",
                      },
                    ]}
                    onPress={() => onEditSlot(slot)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${slot.from} to ${slot.to}`}
                  >
                    <Text style={styles.slotChipText}>
                      {slot.from} – {slot.to}
                    </Text>

                    <TouchableOpacity
                      onPress={() => onRemoveSlot(slot)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${slot.from} to ${slot.to}`}
                    >
                      <Text style={styles.slotRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            !onQuickAdd && (
              <Text style={[styles.daySlotsEmptyText, { marginTop: 6 }]}>
                No slots.
              </Text>
            )
          )}
        </>
      )}
    </View>
  );
};

// ====================== SaveBar ======================

type SaveBarProps = {
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

export const SaveBar: React.FC<SaveBarProps> = ({
  hasChanges,
  saving,
  onSave,
  onDiscard,
}) => {
  if (!hasChanges) return null;

  return (
    <View style={styles.saveBarSticky}>
      <View style={styles.saveRow}>
        <Text style={styles.saveHint}>
          You have unsaved changes. Save to update your profile.
        </Text>

        <TouchableOpacity
          style={styles.discardButton}
          onPress={onDiscard}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={onSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
