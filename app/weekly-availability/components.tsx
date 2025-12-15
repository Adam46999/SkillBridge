// app/weekly-availability/components.tsx
import React from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import type { AvailabilitySlot } from "../../lib/api";
import { styles } from "./styles";

type DaySelectorProps = {
  selectedDay: number;
  onSelect: (dayIndex: number) => void;
  dayNames: string[];
  todayIndex?: number;
};

export function DaySelector({
  selectedDay,
  onSelect,
  dayNames,
  todayIndex,
}: DaySelectorProps) {
  return (
    <View style={styles.daySelectorRow}>
      {dayNames.map((name, idx) => {
        const isSelected = selectedDay === idx;
        const isToday = todayIndex === idx;

        return (
          <TouchableOpacity
            key={`${name}-${idx}`}
            style={[
              styles.dayChip,
              isToday && styles.dayChipToday,
              isSelected && styles.dayChipSelected,
            ]}
            onPress={() => onSelect(idx)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              isToday ? `${name} (Today)` : `${name} (Day ${idx})`
            }
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.dayChipText,
                isToday && styles.dayChipTextToday,
                isSelected && styles.dayChipTextSelected,
              ]}
            >
              {name}
              {isToday ? " •" : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type DayAvailabilityCardProps = {
  dayIndex: number;
  dayLabel: string;
  slots: AvailabilitySlot[];
  onRemoveSlot: (slot: AvailabilitySlot) => void;

  onEditSlot?: (slot: AvailabilitySlot) => void;

  onClearDay: (dayIndex: number) => void;

  // copy day slots
  onCopyDay?: (dayIndex: number) => void;

  // small summary
  totalMinutesForDay?: number;

  // NEW (backward-compatible): optional collapse support (we'll wire it later)
  collapsed?: boolean;
  onToggleCollapsed?: (dayIndex: number) => void;
};

export function DayAvailabilityCard({
  dayIndex,
  dayLabel,
  slots,
  onRemoveSlot,
  onEditSlot,
  onClearDay,
  onCopyDay,
  totalMinutesForDay,
  collapsed = false,
  onToggleCollapsed,
}: DayAvailabilityCardProps) {
  const hasSlots = slots.length > 0;

  const hoursText =
    typeof totalMinutesForDay === "number"
      ? `${Math.floor(totalMinutesForDay / 60)}h ${totalMinutesForDay % 60}m`
      : null;

  const showBody = !collapsed;

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeaderRow}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => onToggleCollapsed?.(dayIndex)}
          disabled={!onToggleCollapsed}
          accessibilityRole={onToggleCollapsed ? "button" : undefined}
          accessibilityLabel={
            onToggleCollapsed
              ? `${collapsed ? "Expand" : "Collapse"} ${dayLabel}`
              : undefined
          }
        >
          <Text style={styles.dayName}>
            {dayLabel}
            {onToggleCollapsed ? (collapsed ? " ▸" : " ▾") : ""}
          </Text>

          {hoursText && hasSlots && (
            <Text style={styles.daySubText}>{hoursText} available</Text>
          )}
        </Pressable>

        <View style={styles.dayHeaderActions}>
          {hasSlots && !!onCopyDay && (
            <TouchableOpacity
              onPress={() => onCopyDay(dayIndex)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${dayLabel} availability`}
            >
              <Text style={styles.copyDayText}>📋 Copy</Text>
            </TouchableOpacity>
          )}

          {hasSlots && (
            <TouchableOpacity
              onPress={() => onClearDay(dayIndex)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${dayLabel} availability`}
            >
              <Text style={styles.clearDayText}>🗑 Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showBody ? (
        hasSlots ? (
          <View style={styles.slotChipRow}>
            {slots.map((slot, idx) => {
              const canEdit = !!onEditSlot;

              return (
                <View
                  key={`${slot.from}-${slot.to}-${idx}`}
                  style={styles.slotChip}
                >
                  <Pressable
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                    onPress={() => onEditSlot?.(slot)}
                    disabled={!canEdit}
                    accessibilityRole={canEdit ? "button" : undefined}
                    accessibilityLabel={
                      canEdit
                        ? `Edit slot ${slot.from} to ${slot.to} on ${dayLabel}`
                        : `Slot ${slot.from} to ${slot.to} on ${dayLabel}`
                    }
                  >
                    <Text style={styles.slotChipText}>
                      {slot.from} – {slot.to}
                      {canEdit ? " ✏️" : ""}
                    </Text>
                  </Pressable>

                  <TouchableOpacity
                    onPress={() => onRemoveSlot(slot)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove slot ${slot.from} to ${slot.to} on ${dayLabel}`}
                  >
                    <Text style={styles.slotRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.daySlotsEmptyText}>
            No availability added for this day yet.
          </Text>
        )
      ) : null}
    </View>
  );
}

type SaveBarProps = {
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
};

export function SaveBar({
  hasChanges,
  saving,
  onSave,
  onDiscard,
}: SaveBarProps) {
  const disabled = !hasChanges || saving;

  return (
    <View style={styles.saveBarSticky}>
      <View style={styles.saveRow}>
        <Text style={styles.saveHint}>
          {hasChanges ? "You have unsaved changes." : "All changes are saved."}
        </Text>

        {hasChanges && !!onDiscard && !saving && (
          <TouchableOpacity
            style={styles.discardButton}
            onPress={onDiscard}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Discard changes"
          >
            <Text style={styles.discardText}>Discard</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.saveButton, disabled && styles.saveButtonDisabled]}
          disabled={disabled}
          onPress={onSave}
          activeOpacity={disabled ? 1 : 0.85}
          accessibilityRole="button"
          accessibilityLabel={saving ? "Saving" : "Save changes"}
          accessibilityState={{ disabled }}
        >
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
