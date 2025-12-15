// server/matching/localMatcher.js
const User = require("../models/User");
const {
  normalizeSkillName,
  computeSkillSimilarity,
  computeLevelCompatibility,
  computeAvailabilityScore,
  computeProfileQuality,
  computeMultiSkillBonus,
} = require("./normalize");
const { buildMatchScore } = require("./scoreUtils");

/**
 * Local heuristic matcher (string-based)
 */
async function findMentorMatchesLocal({
  userId,
  skillQuery,
  level,
  userAvailability,
}) {
  const skillToMatch = String(skillQuery || "").trim();
  const normalizedSkill = normalizeSkillName(skillToMatch);
  const normalizedDesiredLevel = String(level || "Beginner");

  if (!normalizedSkill) return [];

  const requestingUser = await User.findById(userId).lean();
  if (!requestingUser) return [];

  const mentorsRaw = await User.find({
    _id: { $ne: userId },
    skillsToTeach: { $exists: true, $ne: [] },
  }).lean();

  if (!mentorsRaw.length) return [];

  const results = [];

  const studentGoals = Array.isArray(requestingUser.skillsToLearn)
    ? requestingUser.skillsToLearn
    : [];

  const userAvail = Array.isArray(userAvailability) ? userAvailability : [];

  for (const mentor of mentorsRaw) {
    const teachSkills = Array.isArray(mentor.skillsToTeach)
      ? mentor.skillsToTeach
      : [];
    if (!teachSkills.length) continue;

    const mentorAvailability = Array.isArray(mentor.availabilitySlots)
      ? mentor.availabilitySlots
      : [];

    let bestSkill = null;
    let bestSkillSim = 0;

    for (const skillObj of teachSkills) {
      if (!skillObj || !skillObj.name) continue;

      const sim = computeSkillSimilarity(skillToMatch, skillObj.name);
      if (sim < 0.35) continue;

      if (sim > bestSkillSim) {
        bestSkillSim = sim;
        bestSkill = skillObj;
      }
    }

    if (!bestSkill) continue;

    const levelScore = computeLevelCompatibility(
      normalizedDesiredLevel,
      bestSkill.level || "Not specified"
    );

    const availabilityScore = computeAvailabilityScore(
      userAvail,
      mentorAvailability
    );
    const profileQuality = computeProfileQuality(mentor);
    const multiSkillBonus = computeMultiSkillBonus(studentGoals, teachSkills);

    const matchScore = buildMatchScore({
      skillSimilarity: bestSkillSim,
      levelScore,
      availabilityScore,
      profileQuality,
      multiSkillBonus,
    });

    if (matchScore < 0.25) continue;

    results.push({
      mentorId: String(mentor._id),
      fullName: mentor.fullName || "Unknown mentor",
      matchScore,
      mainMatchedSkill: {
        name: bestSkill.name,
        level: bestSkill.level || "Not specified",
        similarityScore: bestSkillSim,
      },
      skillsToTeach: teachSkills,
      availabilitySlots: mentorAvailability,
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, 20);
}

module.exports = { findMentorMatchesLocal };
