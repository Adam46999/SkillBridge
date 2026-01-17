// app/sessions/screens/request/RequestSessionScreen.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

import MentorCard from "./components/MentorCard";
import RequestTopBar from "./components/RequestTopBar";
import StepNote from "./components/StepNote";
import StepPills from "./components/StepPills";
import StepSchedule from "./components/StepSchedule";
import StepSkillLevel from "./components/StepSkillLevel";
import StickyFooter from "./components/StickyFooter";
import { Card, Hint } from "./components/UI";
import { COLORS, SPACING } from "./styles";

import { useRequestSessionForm } from "./(hooks)/useRequestSessionForm";

type Params = {
  mentorId?: string;
  mentorName?: string;
  skill?: string;
  level?: string;
};

// StepLabel removed (was unused)

function InlineError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Text style={{ color: COLORS.danger, marginTop: 10, fontWeight: "900" }}>
      {text}
    </Text>
  );
}

export default function RequestSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();

  const mentorId = useMemo(
    () => String(params.mentorId || "").trim(),
    [params.mentorId]
  );
  const mentorName = useMemo(
    () => String(params.mentorName || "").trim(),
    [params.mentorName]
  );
  const preSkill = useMemo(
    () => String(params.skill || "").trim(),
    [params.skill]
  );
  const preLevel = useMemo(
    () => String(params.level || "").trim(),
    [params.level]
  );

  const form = useRequestSessionForm({
    mentorId,
    mentorName,
    prefillSkill: preSkill,
    prefillLevel: preLevel,
  });

  // UI-only state: show success hint (no logic changes)
  const [sentOk, setSentOk] = useState(false);

  const headerSub = useMemo(() => {
    const n = mentorName?.trim();
    return n ? `Requesting a session with ${n}` : "Requesting a session";
  }, [mentorName]);

  // microSub removed (unused)

  const primaryLabel = useMemo(() => {
    if (form.step === 3) return "Send request";
    return "Continue";
  }, [form.step]);

  const onNext = () => {
    // ✅ no alerts: just reveal inline errors for this step
    if (!form.canGoNext) {
      form.touchStep(form.step);
      return;
    }
    form.next();
  };

  const onSubmit = async () => {
    // reveal all inline errors
    form.touchStep(1);
    form.touchStep(2);
    form.touchStep(3);

    const out = await form.submit();
    if (!out.ok) {
      // ✅ no alert — show inline submitError (hook already sets it)
      return;
    }

    setSentOk(true);

    // Success confirmation is OK (single clean confirmation)
    Alert.alert("Sent ✅", "Your request was sent.", [
      {
        text: "Go to sessions",
        onPress: () => router.replace("/sessions"),
      },
    ]);
  };

  if (!mentorId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <Text style={{ color: COLORS.danger, fontWeight: "900" }}>
          Missing mentorId.
        </Text>
        <Text
          style={{ color: COLORS.muted, marginTop: 8, textAlign: "center" }}
        >
          Open this screen from a mentor profile so it can prefill correctly.
        </Text>
      </View>
    );
  }

  const isLast = form.step === 3;

  const stepTitle =
    form.step === 1 ? "Topic" : form.step === 2 ? "Time" : "Note";

  // Inline error strings per step (no component changes required)
  const topicError =
    form.touched.topic && (form.errors.skill || form.errors.level)
      ? form.errors.skill || form.errors.level
      : undefined;

  const scheduleErrors = form.touched.schedule
    ? { date: form.errors.date, time: form.errors.time }
    : undefined;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={{ padding: SPACING.pagePad, paddingBottom: 28 }}
      >
        <RequestTopBar onBack={() => router.back()} title="Request session" />

        {/* Context header */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 16 }}>
            {headerSub}
          </Text>
          <Text
            style={{
              color: COLORS.hint,
              fontWeight: "800",
              marginTop: 6,
              fontSize: 12,
            }}
          >
            Choose a topic, pick a time, and send.
          </Text>
        </View>

        {/* Mentor summary (fast reassurance) */}
        <View style={{ marginBottom: 12 }}>
          <MentorCard mentorName={mentorName} mentorId={mentorId} />
        </View>

        {/* Stepper */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <StepPills step={form.step} />
          <View style={{ flex: 1 }} />
          <Text
            style={{ color: COLORS.muted, fontWeight: "900", fontSize: 12 }}
          >
            Step {form.step}/3 · {stepTitle}
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <Card>
            {/* Step content */}
            {form.step === 1 ? (
              <>
                <StepSkillLevel
                  skill={form.skill}
                  level={form.level}
                  onChangeSkill={form.setSkill}
                  onChangeLevel={form.setLevel}
                />
                <InlineError text={topicError} />
                <Text
                  style={{
                    marginTop: 10,
                    color: COLORS.tip,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  Tip: keep it short (e.g. “React hooks”, “English speaking”).
                </Text>
              </>
            ) : form.step === 2 ? (
              <StepSchedule
                date={form.date}
                time={form.time}
                onChangeDate={form.setDate}
                onChangeTime={form.setTime}
                errors={scheduleErrors}
                // ✅ use hook helper (no duplicate logic)
                onQuickPick={(preset) => form.quickPick(preset)}
              />
            ) : (
              <>
                {/* Review summary (prevents mistakes before sending) */}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.bg,
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.muted,
                      fontWeight: "900",
                      fontSize: 12,
                    }}
                  >
                    Review
                  </Text>

                  <View style={{ marginTop: 8, gap: 6 }}>
                    <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                      Skill:{" "}
                      <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                        {form.skill?.trim() ? form.skill.trim() : "—"}
                      </Text>
                    </Text>

                    <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                      Level:{" "}
                      <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                        {form.level?.trim() ? form.level.trim() : "—"}
                      </Text>
                    </Text>

                    <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                      When:{" "}
                      <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                        {form.reviewScheduleText}
                      </Text>
                    </Text>
                  </View>
                </View>

                <StepNote note={form.note} onChangeNote={form.setNote} />

                {/* Submit error inline */}
                <InlineError text={form.submitError || undefined} />

                {sentOk ? (
                  <Text
                    style={{
                      marginTop: 10,
                      color: "#86EFAC",
                      fontWeight: "900",
                    }}
                  >
                    Sent successfully ✅
                  </Text>
                ) : null}
              </>
            )}

            {/* Footer */}
            <StickyFooter
              showBack={form.step !== 1}
              backLabel="Back"
              nextLabel={primaryLabel}
              disableNext={!form.canGoNext}
              loading={isLast ? form.submitting : false}
              onBack={form.back}
              onNext={isLast ? onSubmit : onNext}
            />
          </Card>

          {/* One-line help (short + clear) */}
          <View style={{ marginTop: 10 }}>
            <Hint>
              Can’t access this screen? Find Mentor → open a mentor profile →
              Request.
            </Hint>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
