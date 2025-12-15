// app/weekly-availability/styles.ts
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120, // extra space for save bar + toast
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#9CA3AF",
    marginTop: 8,
    fontSize: 14,
  },

  title: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },

  // Section headers (step-by-step)
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 4,
  },
  sectionHint: {
    color: "#64748B",
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },

  // Error box
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
    fontWeight: "700",
    marginBottom: 4,
    fontSize: 13,
  },
  errorBody: {
    color: "#FECACA",
    fontSize: 12,
    marginBottom: 8,
  },

  // Summary card
  summaryCard: {
    backgroundColor: "#0B1120",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 12,
  },
  summaryTitle: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4,
  },
  summaryText: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
    flexWrap: "wrap",
  },
  summaryBadge: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  summaryBadgeText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
  },

  // Day selector row
  daySelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#020617",
  },
  dayChipToday: {
    borderColor: "#60A5FA",
  },
  dayChipSelected: {
    backgroundColor: "#F97316",
    borderColor: "#F97316",
  },
  dayChipText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
  },
  dayChipTextToday: {
    color: "#BFDBFE",
    fontWeight: "800",
  },
  dayChipTextSelected: {
    color: "#0F172A",
    fontWeight: "900",
  },

  // Time input card
  timeCard: {
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 12,
  },
  // subtle state borders (edit vs normal) - safe additions
  timeCardNormal: {
    borderColor: "#1E293B",
  },
  timeCardEditing: {
    borderColor: "#60A5FA",
  },

  timeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  timeLabel: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900",
  },
  timeSelectedDayText: {
    color: "#94A3B8",
    fontSize: 12,
  },

  editBanner: {
    marginTop: 8,
    backgroundColor: "#0B1120",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  editBannerTitle: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 2,
  },
  editBannerSub: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 15,
  },
  editBannerRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  bannerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  bannerBtnText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
  },
  bannerDanger: {
    borderColor: "#7F1D1D",
    backgroundColor: "#451A1A",
  },
  bannerDangerText: {
    color: "#FECACA",
  },
  bannerPrimary: {
    borderColor: "#60A5FA",
    backgroundColor: "#60A5FA",
  },
  bannerPrimaryText: {
    color: "#0F172A",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  timeDash: {
    color: "#9CA3AF",
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: "900",
  },
  timeHint: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  timeErrorText: {
    color: "#FCA5A5",
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },

  // Quick presets
  quickRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
    flexWrap: "wrap",
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  quickChipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  quickChipText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
  },
  quickChipTextActive: {
    color: "#F9FAFB",
    fontWeight: "900",
  },

  // Multi-day add
  multiRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#0B1120",
  },
  multiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },
  multiTopActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  miniActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  miniActionText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
  },

  multiTitle: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
  },
  multiCountText: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 6,
    marginBottom: 8,
    lineHeight: 15,
  },
  multiDaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  multiDayChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  multiDayChipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  multiDayChipText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
  },

  primaryButton: {
    marginTop: 12,
    backgroundColor: "#22C55E",
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryText: {
    color: "#022C22",
    fontWeight: "900",
    fontSize: 13,
  },

  secondaryActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  secondaryBtnText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
  },

  // Day cards list
  dayCard: {
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 10,
  },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 6,
  },
  dayHeaderActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  dayName: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "900",
  },
  daySubText: {
    marginTop: 2,
    color: "#94A3B8",
    fontSize: 11,
  },
  clearDayText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
  },
  copyDayText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "900",
  },
  daySlotsEmptyText: {
    color: "#6B7280",
    fontSize: 12,
  },

  slotChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 10,
  },
  slotChipText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
  },
  slotRemoveText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
  },

  // Save bar (sticky)
  saveBarSticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2,6,23,0.95)",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  saveHint: {
    color: "#94A3B8",
    fontSize: 12,
    flex: 1,
  },
  discardButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  discardText: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    minWidth: 110,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: "#022C22",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },

  // Time picker field
  timeFieldBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#0F172A",
  },
  timeFieldLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
  },
  timeFieldValue: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0B1120",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
    color: "#F9FAFB",
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  modalCancel: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "800",
  },
  modalDone: {
    fontSize: 14,
    fontWeight: "900",
    color: "#F9FAFB",
  },

  // Copy modal list
  copyList: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  copyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  copyChipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  copyChipText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
  },
  copyHint: {
    marginTop: 10,
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 16,
  },

  // Toast
  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 84, // above save bar
    alignItems: "center",
    justifyContent: "center",
  },
  toastCard: {
    backgroundColor: "rgba(11,17,32,0.96)",
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: {
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: "800",
  },
});
