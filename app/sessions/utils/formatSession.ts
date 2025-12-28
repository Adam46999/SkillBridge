// app/sessions/utils/formatSession.ts
// I AM THE REAL formatSession.ts

import type { SessionStatus } from "../api/sessionsApi";

export function formatSessionDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString();
}

export function statusBadge(
  status: SessionStatus
): { label: string; bg: string; border: string; text: string } {
  switch (status) {
    case "requested":
      return { label: "Requested", bg: "#0B1120", border: "#1E293B", text: "#E5E7EB" };
    case "accepted":
      return { label: "Accepted", bg: "#052E16", border: "#16A34A", text: "#D1FAE5" };
    case "rejected":
      return { label: "Rejected", bg: "#450A0A", border: "#EF4444", text: "#FEE2E2" };
    case "cancelled":
      return { label: "Cancelled", bg: "#111827", border: "#6B7280", text: "#E5E7EB" };
    case "completed":
      return { label: "Completed", bg: "#0B1120", border: "#F97316", text: "#FED7AA" };
    default:
      return { label: String(status), bg: "#0B1120", border: "#1E293B", text: "#E5E7EB" };
  }
}
