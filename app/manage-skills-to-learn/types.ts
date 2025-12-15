// app/manage-skills-to-learn/types.ts

export const LEARN_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Not specified",
] as const;

export type LearnLevel = (typeof LEARN_LEVELS)[number];

export type SkillToLearn = {
  name: string;
  level: LearnLevel;
};

export type UndoState = {
  skill: SkillToLearn;
  index: number;
} | null;
