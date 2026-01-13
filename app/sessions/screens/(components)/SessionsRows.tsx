// app/sessions/screens/(components)/SessionsRows.ts
import type { SessionDTO } from "../../api/sessionsApi";

export type StatusFilter =
  | "all"
  | "requested"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed";

export type Row =
  | { type: "header"; key: string; title: string; count: number }
  | { type: "session"; key: string; session: SessionDTO };

function toDate(v: any) {
  const d = new Date(String(v || ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeId(s: any) {
  return String(s?._id || s?.id || "").trim();
}

function normStatus(v: any) {
  const st = String(v || "")
    .trim()
    .toLowerCase();
  if (st === "canceled") return "cancelled";
  if (st === "done") return "completed";
  return st;
}

function getWhen(s: any): Date | null {
  // scheduledAt هو الأساس، وإذا مش موجود خليه fallback createdAt
  return toDate(s?.scheduledAt) || toDate(s?.createdAt) || null;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayTitleSmart(d: Date) {
  const today = startOfDay(new Date());
  const that = startOfDay(d);

  const diffDays = Math.round(
    (that.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  const dow = d.toLocaleDateString(undefined, { weekday: "long" });
  const md = d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
  return `${dow} · ${md}`;
}

// ✅ status priority داخل اليوم (أهم شيء فوق)
function statusRank(st: string) {
  const s = normStatus(st);
  if (s === "requested") return 0;
  if (s === "accepted") return 1;
  if (s === "completed") return 2;
  if (s === "cancelled") return 3;
  if (s === "rejected") return 4;
  return 9;
}

export function filterSessionsByStatus(
  sessions: SessionDTO[],
  statusFilter: StatusFilter
) {
  if (statusFilter === "all") return sessions;
  const target = normStatus(statusFilter);

  return (Array.isArray(sessions) ? sessions : []).filter((s: any) => {
    const st = normStatus(s?.status);
    return st === target;
  });
}

export function computeStatusCounts(sessions: SessionDTO[]) {
  const list = Array.isArray(sessions) ? sessions : [];

  const byStatus = {
    requested: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
  };

  for (const x of list as any[]) {
    const st = normStatus(x?.status);
    if (st === "requested") byStatus.requested++;
    else if (st === "accepted") byStatus.accepted++;
    else if (st === "rejected") byStatus.rejected++;
    else if (st === "cancelled") byStatus.cancelled++;
    else if (st === "completed") byStatus.completed++;
  }

  return { total: list.length, byStatus };
}

export function buildGroupedRows(filteredSessions: SessionDTO[]): Row[] {
  const list = Array.isArray(filteredSessions) ? filteredSessions : [];

  // Groups by date + special "unknown"
  const map = new Map<string, { date: Date | null; list: SessionDTO[] }>();

  for (const s of list) {
    const d = getWhen(s);
    const k = d ? dayKey(d) : "unknown";

    const g = map.get(k);
    if (!g) map.set(k, { date: d, list: [s] });
    else g.list.push(s);
  }

  // Sort groups: unknown آخر شيء، والباقي حسب التاريخ (desc)
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "unknown" && b === "unknown") return 0;
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;

    const da = map.get(a)!.date?.getTime() ?? 0;
    const db = map.get(b)!.date?.getTime() ?? 0;
    return db - da;
  });

  const out: Row[] = [];

  for (const k of keys) {
    const g = map.get(k)!;

    // Sort sessions داخل اليوم:
    // 1) status priority
    // 2) time (newer first)
    g.list.sort((a: any, b: any) => {
      const ra = statusRank(a?.status);
      const rb = statusRank(b?.status);
      if (ra !== rb) return ra - rb;

      const ta = getWhen(a)?.getTime() ?? 0;
      const tb = getWhen(b)?.getTime() ?? 0;
      return tb - ta;
    });

    out.push({
      type: "header",
      key: `h:${k}`,
      title: k === "unknown" ? "Unknown date" : dayTitleSmart(g.date as Date),
      count: g.list.length,
    });

    for (let i = 0; i < g.list.length; i++) {
      const s: any = g.list[i];
      const id = safeId(s);
      // ✅ key ثابت (بدون random)
      out.push({
        type: "session",
        key: `s:${id || `${k}:${i}`}`,
        session: s,
      });
    }
  }

  return out;
}
