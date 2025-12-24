// app/screens/homescreen.styles.ts
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },

  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: { color: "#E5E7EB", fontSize: 16, fontWeight: "900" },

  nameWrap: { marginLeft: 12 },
  nameText: { color: "#E5E7EB", fontSize: 16, fontWeight: "900" },
  metaText: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 2 },

  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0B1220",
  },

  card: {
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  cardTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "900", marginBottom: 8 },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flexDirection: "row", alignItems: "center" },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },

  pillText: { color: "#E5E7EB", fontSize: 12, fontWeight: "800" },

  small: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#111827", marginVertical: 12 },

  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },

  actionText: { color: "#E5E7EB", fontSize: 13, fontWeight: "900" },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B5563",
  },

  logoutText: { color: "#E5E7EB", fontSize: 12 },
});
