// app/sessions/screens/request/(hooks)/useRequestSessionForm.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useMemo, useState } from "react";

import { requestSession, type SessionDTO } from "../../../api/sessionsApi";


type Errors = {
  skill?: string;
  level?: string;
  date?: string;
  time?: string;
};

type Touched = {
  topic: boolean;
  schedule: boolean;
  note: boolean;
};

export type RequestSessionFormInit = {
  mentorId: string;
  mentorName?: string;
  prefillSkill?: string;
  prefillLevel?: string;
};
export type Step = 1 | 2 | 3;

function normalizeStr(v: any) {
  return String(v ?? "").trim();
}

function isValidTimeHHMM(t: string) {
  // very safe: accept "HH:MM" 00:00..23:59
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
}

function isValidDateYYYYMMDD(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function todayYYYYMMDD() {
  const dt = new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildISO(dateYYYYMMDD: string, timeHHMM: string) {
  // local time -> ISO
  const [y, m, d] = dateYYYYMMDD.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return dt.toISOString();
}

export function useRequestSessionForm(init: RequestSessionFormInit) {
const [step, setStep] = useState<Step>(1);

  const [skill, setSkill] = useState<string>(normalizeStr(init.prefillSkill));
  const [level, setLevel] = useState<string>(normalizeStr(init.prefillLevel));

  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [time, setTime] = useState<string>(""); // HH:MM

  const [note, setNote] = useState<string>("");

  const [touched, setTouched] = useState<Touched>({
    topic: false,
    schedule: false,
    note: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [created, setCreated] = useState<SessionDTO | null>(null);

  const errors: Errors = useMemo(() => {
    const e: Errors = {};

    // Step 1
    if (!normalizeStr(skill)) e.skill = "Please enter a skill/topic.";
    if (!normalizeStr(level)) e.level = "Please choose a level.";

    // Step 2
    if (!normalizeStr(date)) e.date = "Please choose a date.";
    else if (!isValidDateYYYYMMDD(date)) e.date = "Invalid date format.";
    if (!normalizeStr(time)) e.time = "Please choose a time.";
    else if (!isValidTimeHHMM(time)) e.time = "Invalid time format.";

    return e;
  }, [skill, level, date, time]);

  const canGoNext = useMemo(() => {
    if (step === 1) return !errors.skill && !errors.level;
    if (step === 2) return !errors.date && !errors.time;
    return true; // step 3 always allows submit button (hook submit validates)
  }, [step, errors]);

const touchStep = useCallback((s: Step) => {
    setTouched((prev) => {
      if (s === 1) return { ...prev, topic: true };
      if (s === 2) return { ...prev, schedule: true };
      if (s === 3) return { ...prev, note: true };
      return prev;
    });
  }, []);

 const next = useCallback(() => {
  setStep((p) => (p === 1 ? 2 : p === 2 ? 3 : 3));
}, []);

const back = useCallback(() => {
  setStep((p) => (p === 3 ? 2 : p === 2 ? 1 : 1));
}, []);


  const reviewScheduleText = useMemo(() => {
    const d = normalizeStr(date);
    const t = normalizeStr(time);
    if (!d && !t) return "—";
    if (d && t) return `${d} ${t}`;
    return d || t;
  }, [date, time]);

  // StepSchedule "quick pick" can pass either:
  // - { date: "YYYY-MM-DD", time: "HH:MM" }
  // - or a string preset (we handle a few common ones safely)
  const quickPick = useCallback((preset: any) => {
    // object form
    if (preset && typeof preset === "object") {
      const d = normalizeStr(preset.date);
      const t = normalizeStr(preset.time);
      if (d) setDate(d);
      if (t) setTime(t);
      return;
    }

    // string presets (safe defaults)
    const p = normalizeStr(preset);
    const today = todayYYYYMMDD();
    
    if (p === "today") {
      setDate(today);
      return;
    }
    
    if (p === "tomorrow") {
      const dt = new Date();
      dt.setDate(dt.getDate() + 1);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
      return;
    }
    
    if (p === "plus30") {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setDate(today);
      setTime(`${hh}:${mm}`);
      return;
    }
    
    if (p === "plus60") {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 60);
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setDate(today);
      setTime(`${hh}:${mm}`);
      return;
    }
    
    if (p === "today_18") {
      setDate(today);
      setTime("18:00");
      return;
    }
    if (p === "today_19") {
      setDate(today);
      setTime("19:00");
      return;
    }
  }, []);

  const submit = useCallback(async () => {
    setSubmitError("");

    // validate all
    const s = normalizeStr(skill);
    const l = normalizeStr(level);
    const d = normalizeStr(date);
    const t = normalizeStr(time);

    if (!init.mentorId) {
      setSubmitError("Missing mentorId.");
      return { ok: false as const };
    }
    if (!s || !l || !d || !t || errors.skill || errors.level || errors.date || errors.time) {
      setSubmitError("Please fix the missing fields above.");
      return { ok: false as const };
    }

    let token = "";
    try {
      token = (await AsyncStorage.getItem("token")) || "";
    } catch {
      token = "";
    }

    if (!token) {
      setSubmitError("You are not logged in. Please login again.");
      return { ok: false as const };
    }

    setSubmitting(true);
    try {
      const scheduledAt = buildISO(d, t);

      const createdSession = await requestSession(token, {
        mentorId: init.mentorId,
        skill: s,
        level: l,
        scheduledAt,
        note: normalizeStr(note),
      });

      setCreated(createdSession);
      return { ok: true as const, session: createdSession };
    } catch (e: any) {
      setSubmitError(e?.message || "Failed to send request.");
      return { ok: false as const };
    } finally {
      setSubmitting(false);
    }
  }, [init.mentorId, skill, level, date, time, note, errors]);

  return {
    // expected by RequestSessionScreen
    step,
    touched,
    errors,
    submitting,
    submitError,
    created,

    skill,
    level,
    date,
    time,
    note,

    setSkill,
    setLevel,
    setDate,
    setTime,
    setNote,

    canGoNext,
    next,
    back,
    touchStep,
    quickPick,
    reviewScheduleText,

    submit,
  };
}
