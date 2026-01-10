import type { AvailabilitySlot } from "@/lib/api";
import type { ChatInboxItem } from "@/lib/chat/api";

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getLevelFromXp(xp?: number) {
  const val = xp ?? 0;
  const level = Math.floor(val / 100);
  const progress = val % 100;
  return { level, progress };
}

export function timeToMinutes(t: string) {
  const [h, m] = String(t || "0:0").split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

export function calcTotalMinutes(slots: AvailabilitySlot[]) {
  return slots.reduce((sum, s) => {
    const a = timeToMinutes(s.from);
    const b = timeToMinutes(s.to);
    return sum + Math.max(0, b - a);
  }, 0);
}

export function minutesToHuman(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function availabilityLabelFromMinutes(min: number) {
  if (min >= 600) return "🟢 Excellent";
  if (min >= 240) return "🟡 Good";
  if (min > 0) return "🔴 Low";
  return "Not set";
}

export function inferNextLine(user: any, inbox: ChatInboxItem[]) {
  const learnCount = user?.skillsToLearn?.length || 0;
  const hasInbox = inbox.length > 0;

  if (learnCount === 0) return "Next: add a learning goal to get better matches.";
  if (!hasInbox) return "Next: find a mentor and send your first message.";
  return "Next: open a chat or request a session with a mentor.";
}
