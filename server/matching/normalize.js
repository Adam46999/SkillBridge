// server/matching/normalize.js

function normalize(str) {
  if (!str) return "";
  return String(str).toLowerCase().trim();
}

// Synonyms بسيطة للسكيلز الشائعة
const SKILL_SYNONYMS = {
  js: "javascript",
  node: "node.js",
  nodejs: "node.js",
  rn: "react-native",
  "react native": "react-native",
};

function normalizeSkillName(name) {
  let s = normalize(name)
    .replace(/[()+\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (SKILL_SYNONYMS[s]) s = SKILL_SYNONYMS[s];
  return s;
}

/**
 * Pure string-based similarity between two skill names (0..1)
 */
function computeSkillSimilarity(a, b) {
  const s1 = normalizeSkillName(a);
  const s2 = normalizeSkillName(b);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  if (s1.startsWith(s2) || s2.startsWith(s1)) return 0.9;
  if (s1.includes(s2) || s2.includes(s1)) return 0.7;

  const tokens1 = new Set(s1.split(/\s+/));
  const tokens2 = new Set(s2.split(/\s+/));

  let intersection = 0;
  for (const t of tokens1) if (tokens2.has(t)) intersection++;

  const union = tokens1.size + tokens2.size - intersection;
  if (union === 0) return 0;

  const jaccard = intersection / union;
  return Math.max(0.3, Math.min(0.6, jaccard));
}

// ========== Levels ==========

function mapLevelToNumber(level) {
  const l = normalize(level);
  if (l.includes("advanced")) return 3;
  if (l.includes("intermediate")) return 2;
  if (l.includes("beginner")) return 1;
  return 2;
}

/**
 * Level compatibility with direction:
 * mentor >= student أفضل
 * 0..1
 */
function computeLevelCompatibility(requestLevel, mentorLevel) {
  const req = mapLevelToNumber(requestLevel);
  const men = mapLevelToNumber(mentorLevel);

  const diff = men - req;

  if (diff >= 0) {
    if (diff === 0) return 1.0;
    if (diff === 1) return 0.9;
    return 0.8;
  } else {
    const absDiff = Math.abs(diff);
    if (absDiff === 1) return 0.5;
    return 0.2;
  }
}

// ========== Availability ==========

function timeToMinutes(t) {
  const [h, m] = String(t || "0:0")
    .split(":")
    .map(Number);
  return (h || 0) * 60 + (m || 0);
}

function computeTotalOverlapMinutes(
  userAvailability = [],
  mentorAvailability = []
) {
  if (!userAvailability.length || !mentorAvailability.length) return 0;

  let total = 0;

  for (const ua of userAvailability) {
    for (const ma of mentorAvailability) {
      if (ua.dayOfWeek !== ma.dayOfWeek) continue;

      const start1 = timeToMinutes(ua.from);
      const end1 = timeToMinutes(ua.to);
      const start2 = timeToMinutes(ma.from);
      const end2 = timeToMinutes(ma.to);

      const overlap = Math.max(
        0,
        Math.min(end1, end2) - Math.max(start1, start2)
      );
      total += overlap;
    }
  }

  return total;
}

function computeAvailabilityScore(
  userAvailability = [],
  mentorAvailability = []
) {
  if (!userAvailability.length || !mentorAvailability.length) return 0.4;

  const overlapMinutes = computeTotalOverlapMinutes(
    userAvailability,
    mentorAvailability
  );

  if (overlapMinutes <= 0) {
    const sameDay = userAvailability.some((ua) =>
      mentorAvailability.some((ma) => ma.dayOfWeek === ua.dayOfWeek)
    );
    return sameDay ? 0.5 : 0.2;
  }

  const ratio = Math.min(overlapMinutes / 240, 1);

  if (ratio >= 0.75) return 1.0;
  if (ratio >= 0.4) return 0.8;
  if (ratio >= 0.15) return 0.6;
  return 0.4;
}

// ========== Profile Quality & Multi-skill Context ==========

function computeProfileQuality(mentor) {
  let score = 0;

  if (mentor.fullName) score += 0.05;

  if (typeof mentor.avgRating === "number" && mentor.ratingCount > 0) {
    const normRating = Math.max(0, Math.min(mentor.avgRating / 5, 1));
    score += 0.25 * normRating;
    if (mentor.ratingCount >= 5) score += 0.05;
    if (mentor.ratingCount >= 20) score += 0.05;
  }

  if (Array.isArray(mentor.skillsToTeach) && mentor.skillsToTeach.length >= 1) {
    score += 0.1;
  }
  if (mentor.skillsToTeach && mentor.skillsToTeach.length >= 3) {
    score += 0.15;
  }

  if (
    Array.isArray(mentor.availabilitySlots) &&
    mentor.availabilitySlots.length > 0
  ) {
    score += 0.15;
  }

  if (mentor.points && mentor.points > 0) score += 0.05;
  if (mentor.xp && mentor.xp > 0) score += 0.05;

  if (
    mentor.preferences &&
    Array.isArray(mentor.preferences.languages) &&
    mentor.preferences.languages.length > 0
  ) {
    score += 0.05;
  }

  return Math.min(score, 1);
}

/**
 * Bonus لو المدرس يغطي أكثر من هدف من أهداف الطالب
 * 0..0.2
 */
function computeMultiSkillBonus(studentGoals = [], mentorSkills = []) {
  if (!studentGoals.length || !mentorSkills.length) return 0;

  // supports goals being either string OR {name, level}
  const goalNames = studentGoals
    .map((g) => (typeof g === "string" ? g : g?.name))
    .filter(Boolean);

  const goalSet = new Set(goalNames.map((s) => normalizeSkillName(s)));
  const mentorSet = new Set(
    mentorSkills.map((s) => normalizeSkillName(s.name))
  );

  let common = 0;
  for (const g of goalSet) {
    if (mentorSet.has(g)) common++;
  }

  if (common === 0) return 0;
  return Math.min(common * 0.05, 0.2);
}

module.exports = {
  normalizeSkillName,
  computeSkillSimilarity,
  computeLevelCompatibility,
  computeAvailabilityScore,
  computeProfileQuality,
  computeMultiSkillBonus,
};
