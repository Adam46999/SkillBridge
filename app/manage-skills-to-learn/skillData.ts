// app/manage-skills-to-learn/skillData.ts

export type SkillSubCategory = {
  id: string;
  name: string;
  skills: string[];
};

export type SkillCategory = {
  id: string;
  name: string;
  icon: string; // ✅ FIX
  subCategories: SkillSubCategory[];
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: "programming",
    name: "Programming",
    icon: "💻",
    subCategories: [
      {
        id: "frontend",
        name: "Frontend",
        skills: ["HTML", "CSS", "JavaScript", "React", "TypeScript"],
      },
      {
        id: "backend",
        name: "Backend",
        skills: ["Node.js", "Express", "MongoDB", "SQL"],
      },
    ],
  },
  {
    id: "languages",
    name: "Languages",
    icon: "🗣️",
    subCategories: [
      {
        id: "spoken",
        name: "Spoken",
        skills: ["English", "Hebrew", "Arabic", "Spanish"],
      },
    ],
  },
];

export const RECOMMENDED_SKILLS = ["Public speaking", "Time management", "Problem solving"];

export const ALL_KNOWN_SKILLS = Array.from(
  new Set(SKILL_CATEGORIES.flatMap((c) => c.subCategories.flatMap((s) => s.skills)))
);
