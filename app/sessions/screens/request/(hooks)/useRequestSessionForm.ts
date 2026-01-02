// app/sessions/screens/request/(hooks)/useRequestSessionForm.ts
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import type { SessionDTO } from "../../../api/sessionsApi";
import { requestSession } from "../../../api/sessionsApi";

export type Step = "mentor" | "details" | "schedule" | "review";

export type RequestSessionFormInit = {
  token: string | null;

  mentorId?: string;
  mentorName?: string;

  skill?: string;
  level?: string;

  // optional: prefilled schedule/note
  scheduledAt?: string;
  note?: string;
};

type Errors = Partial<Record<keyof FormState, string>> & { general?: string };

type FormState = {
  mentorId: string;
  mentorName: string;
  skill: string;
  level: string;
  scheduledAt: string; // ISO string
  note: string;
};

function normalize(v: any) {
  return String(v ?? "").trim();
}

function isValidIso(iso: string) {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime());
}

function isFutureOrNow(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - 60 * 1000; // allow 1 minute tolerance
}

export function useRequestSessionForm(init: RequestSessionFormInit) {
  const [step, setStep] = useState<Step>("mentor");

  const [state, setState] = useState<FormState>(() => ({
    mentorId: normalize(init.mentorId),
    mentorName: normalize(init.mentorName),
    skill: normalize(init.skill),
    level: normalize(init.level),
    scheduledAt: normalize(init.scheduledAt),
    note: normalize(init.note),
  }));

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<SessionDTO | null>(null);

  const steps: Step[] = useMemo(
    () => ["mentor", "details", "schedule", "review"],
    []
  );

  const stepIndex = useMemo(
    () => steps.findIndex((s) => s === step),
    [steps, step]
  );

  const setField = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setState((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined, general: undefined }));
  }, []);

  const setMany = useCallback((patch: Partial<FormState>) => {
    setState((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => ({ ...prev, general: undefined }));
  }, []);

  const validate = useCallback(
    (forStep: Step): boolean => {
      const next: Errors = {};

      const mentorId = normalize(state.mentorId);
      const skill = normalize(state.skill);
      const level = normalize(state.level);
      const scheduledAt = normalize(state.scheduledAt);

      if (forStep === "mentor") {
        if (!mentorId) next.mentorId = "Choose a mentor first.";
      }

      if (forStep === "details") {
        if (!mentorId) next.mentorId = "Choose a mentor first.";
        if (!skill) next.skill = "Choose a skill.";
        if (!level) next.level = "Choose a level.";
      }

      if (forStep === "schedule") {
        if (!mentorId) next.mentorId = "Choose a mentor first.";
        if (!skill) next.skill = "Choose a skill.";
        if (!scheduledAt) next.scheduledAt = "Pick date & time.";
        else if (!isValidIso(scheduledAt)) next.scheduledAt = "Invalid date.";
        else if (!isFutureOrNow(scheduledAt))
          next.scheduledAt = "Time must be in the future.";
      }

      if (forStep === "review") {
        if (!mentorId) next.mentorId = "Choose a mentor first.";
        if (!skill) next.skill = "Choose a skill.";
        if (!level) next.level = "Choose a level.";
        if (!scheduledAt) next.scheduledAt = "Pick date & time.";
        else if (!isValidIso(scheduledAt)) next.scheduledAt = "Invalid date.";
      }

      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [state]
  );

  const canGoNext = useMemo(() => validate(step), [step, validate]);

  const nextStep = useCallback(() => {
    // validate current step before moving
    if (!validate(step)) return;

    const idx = steps.findIndex((s) => s === step);
    if (idx < 0) return;

    const next = steps[Math.min(steps.length - 1, idx + 1)];
    setStep(next);
  }, [step, steps, validate]);

  const prevStep = useCallback(() => {
    const idx = steps.findIndex((s) => s === step);
    if (idx <= 0) return;
    const prev = steps[idx - 1];
    setStep(prev);
  }, [step, steps]);

  const jumpTo = useCallback(
    (to: Step) => {
      // allow jumping only backward freely, forward requires validation through the chain
      const fromIdx = steps.indexOf(step);
      const toIdx = steps.indexOf(to);
      if (toIdx < 0) return;
      if (toIdx <= fromIdx) {
        setStep(to);
        return;
      }

      // forward jump: validate each intermediate step
      let ok = true;
      for (let i = fromIdx; i < toIdx; i++) {
        const s = steps[i];
        if (!validate(s)) {
          ok = false;
          break;
        }
      }
      if (ok) setStep(to);
    },
    [step, steps, validate]
  );

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!init.token) {
      Alert.alert("Not logged in", "Please login again.");
      return;
    }

    // validate everything
    if (!validate("review")) return;

    const body = {
      mentorId: normalize(state.mentorId),
      skill: normalize(state.skill),
      level: normalize(state.level) || undefined,
      scheduledAt: normalize(state.scheduledAt),
      note: normalize(state.note) || undefined,
    };

    try {
      setSubmitting(true);
      setErrors({});
      const s = await requestSession(init.token, body);
      setCreated(s);
      return s;
    } catch (e: any) {
      const msg = e?.message || "Failed to request session.";
      setErrors((prev) => ({ ...prev, general: msg }));
      Alert.alert("Request failed", msg);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [init.token, state, submitting, validate]);

  const reset = useCallback(() => {
    setStep("mentor");
    setSubmitting(false);
    setErrors({});
    setCreated(null);
    setState({
      mentorId: normalize(init.mentorId),
      mentorName: normalize(init.mentorName),
      skill: normalize(init.skill),
      level: normalize(init.level),
      scheduledAt: normalize(init.scheduledAt),
      note: normalize(init.note),
    });
  }, [init.level, init.mentorId, init.mentorName, init.note, init.scheduledAt, init.skill]);

  return {
    // state
    step,
    steps,
    stepIndex,

    // values
    ...state,
    errors,
    submitting,
    created,

    // setters
    setField,
    setMany,
    setStep,
    jumpTo,

    // nav
    canGoNext,
    nextStep,
    prevStep,

    // actions
    validate,
    submit,
    reset,
  };
}
