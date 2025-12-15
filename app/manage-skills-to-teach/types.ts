// app/manage-skills-to-teach/types.ts

export const TEACH_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Not specified",
] as const;

export type Level = (typeof TEACH_LEVELS)[number];

export type SkillTeach = {
  name: string;
  level: Level;
};

export type UndoState = {
  skill: SkillTeach;
  index: number;
} | null;
