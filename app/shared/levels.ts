// app/shared/levels.ts

export const LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
] as const;

export type Level = (typeof LEVELS)[number];

/**
 * ترتيب المستويات للمقارنة
 * كل ما الرقم أكبر → مستوى أعلى
 */
export const LEVEL_RANK: Record<Level, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};
