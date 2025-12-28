import { StyleSheet } from "react-native";

export const authStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },

  content: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 28,
  },

  /* ===== Header ===== */
  header: { marginBottom: 18 },
  title: {
    color: "#F9FAFB",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },

  /* ===== Errors ===== */
  bannerError: {
    backgroundColor: "#451A1A",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 14,
  },
  bannerErrorText: {
    color: "#FECACA",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },

  inlineErrorBox: { marginTop: 6 },
  inlineErrorText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "800",
  },

  /* ===== Fields ===== */
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },

  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "700",
  },

  inputError: {
    borderColor: "#FCA5A5",
  },

  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#020617",
  },
  eyeText: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 12,
  },

  /* ===== Buttons ===== */
  primaryBtn: {
    marginTop: 10,
    backgroundColor: "#22C55E",
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    color: "#022C22",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  /* ===== Links ===== */
  linkRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  linkText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  linkBtn: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "900",
  },
});
