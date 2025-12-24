// lib/profileCompletion.ts
import type { AvailabilitySlot, SkillLearn, SkillTeach } from "./api";

export type ProfileCompletionSection = {
  key: "basics" | "learn" | "teach" | "availability";
  title: string;
  done: boolean;
  hint: string;
  ctaLabel: string;
  href: string; // expo-router route
};

export type ProfileCompletionStatus = {
  percent: number; // 0..100
  isComplete: boolean;
  doneCount: number;
  totalCount: number;
  sections: ProfileCompletionSection[];
};

type UserLike = {
  fullName?: string;
  email?: string;
  skillsToLearn?: SkillLearn[];
  skillsToTeach?: SkillTeach[];
  availabilitySlots?: AvailabilitySlot[];
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function bool(v: any) {
  return !!v;
}

export function getProfileCompletionStatus(user: UserLike | null | undefined): ProfileCompletionStatus {
  const fullName = (user?.fullName || "").trim();
  const email = (user?.email || "").trim();

  const hasBasics = bool(fullName) && bool(email);

  const learnCount = user?.skillsToLearn?.length ?? 0;
  const teachCount = user?.skillsToTeach?.length ?? 0;
  const availabilityCount = user?.availabilitySlots?.length ?? 0;

  const hasLearn = learnCount > 0;
  const hasTeach = teachCount > 0;
  const hasAvailability = availabilityCount > 0;

  const sections: ProfileCompletionSection[] = [
    {
      key: "basics",
      title: "Profile basics",
      done: hasBasics,
      hint: hasBasics ? "Looks good." : "Add your name + email to finish the basics.",
      ctaLabel: hasBasics ? "View" : "Fix basics",
      // لو عندك شاشة بروفايل لاحقاً غيّر الرابط
      href: "/settings",
    },
    {
      key: "learn",
      title: "Skills to learn",
      done: hasLearn,
      hint: hasLearn
        ? `You have ${learnCount} learning goal${learnCount === 1 ? "" : "s"}.`
        : "Add at least 1 skill you want to learn (improves matching).",
      ctaLabel: hasLearn ? "Manage" : "Add skills",
      href: "/manage-skills-to-learn",
    },
    {
      key: "teach",
      title: "Skills to teach",
      done: hasTeach,
      hint: hasTeach
        ? `You can teach ${teachCount} skill${teachCount === 1 ? "" : "s"}.`
        : "Add at least 1 skill you can teach (unlocks more matches).",
      ctaLabel: hasTeach ? "Manage" : "Add skills",
      href: "/manage-skills-to-teach",
    },
    {
      key: "availability",
      title: "Weekly availability",
      done: hasAvailability,
      hint: hasAvailability
        ? `You have ${availabilityCount} time slot${availabilityCount === 1 ? "" : "s"} set.`
        : "Set 1–2 time slots so mentors can align with you.",
      ctaLabel: hasAvailability ? "Edit" : "Set now",
      href: "/weekly-availability",
    },
  ];

  const totalCount = sections.length;
  const doneCount = sections.filter((s) => s.done).length;

  // ✅ وزن متساوي وبسيط
  const percent = clamp(Math.round((doneCount / totalCount) * 100), 0, 100);
  const isComplete = doneCount === totalCount;

  return { percent, isComplete, doneCount, totalCount, sections };
}
