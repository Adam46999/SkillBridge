// app/sessions/screens/request/styles.ts

export const COLORS = {
  bg: "#020617",
  card: "#0B1120",

  border: "#1E293B",
  borderSoft: "#111827",
  fieldBorder: "#1F2937",

  text: "#E5E7EB",
  muted: "#94A3B8",
  hint: "#64748B",
  tip: "#334155",

  link: "#60A5FA",
  danger: "#FCA5A5",

  orange: "#F97316",
  orangeBorder: "#FB923C",
};

export const SPACING = {
  pagePad: 16,
  cardPad: 14,

  radius: 16,
  pillRadius: 999,

  // consistent hit targets (fast + accessible)
  tapMinH: 44,
  inputMinH: 48,
};

export const shadowCard = {
  borderWidth: 1,
  borderColor: COLORS.border,
  backgroundColor: COLORS.card,
  borderRadius: SPACING.radius,
  padding: SPACING.cardPad,

  // subtle depth (no performance heavy shadows)
  // RN Android: elevation is cheap
  elevation: 1,
};

export const fieldBase = {
  marginTop: 8,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: COLORS.fieldBorder,
  backgroundColor: COLORS.bg,

  color: COLORS.text,
  paddingHorizontal: 12,
  paddingVertical: 12,

  fontWeight: "800" as const,

  minHeight: SPACING.inputMinH,
};
