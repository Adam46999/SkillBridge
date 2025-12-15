// server/matching/openaiMatcher.js
const User = require("../models/User");
const { getEmbedding } = require("./embeddingService");
const {
  computeLevelCompatibility,
  computeAvailabilityScore,
  computeProfileQuality,
  computeMultiSkillBonus,
} = require("./normalize");
const { cosineSimilarity, buildMatchScore } = require("./scoreUtils");

/**
 * OpenAI embedding matcher (SAFE optimized):
 * - embedding(skillQuery)
 * - cosine similarity with each mentor skill embedding
 * - batch-save embeddings per mentor (1 write max)
 */
async function findMentorMatchesOpenAI({
  userId,
  skillQuery,
  level,
  userAvailability,
}) {
  const skillToMatch = String(skillQuery || "").trim();
  const normalizedDesiredLevel = String(level || "Beginner");
  if (!skillToMatch) return [];

  const requestingUser = await User.findById(userId).lean();
  if (!requestingUser) return [];

  const mentorsRaw = await User.find({
    _id: { $ne: userId },
    skillsToTeach: { $exists: true, $ne: [] },
  }).lean();

  if (!mentorsRaw.length) return [];

  const queryEmbedding = await getEmbedding(skillToMatch);
  if (!queryEmbedding) return [];

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
    let bestSim = 0;

    let changed = false;
    const updatedTeachSkills = teachSkills.map((s) => ({ ...s }));

    for (let i = 0; i < updatedTeachSkills.length; i++) {
      const skillObj = updatedTeachSkills[i];
      if (!skillObj || !skillObj.name) continue;

      let emb = skillObj.embedding;

      // fetch embedding only if missing
      if (!Array.isArray(emb) || emb.length === 0) {
        try {
          emb = await getEmbedding(skillObj.name);
          if (emb) {
            skillObj.embedding = emb;
            changed = true;
          }
        } catch {
          continue; // ignore single skill failure
        }
      }

      const sim = cosineSimilarity(queryEmbedding, emb);
      if (sim > bestSim) {
        bestSim = sim;
        bestSkill = skillObj;
      }
    }

    // write back embeddings once per mentor
    if (changed) {
      try {
        await User.updateOne(
          { _id: mentor._id },
          { $set: { skillsToTeach: updatedTeachSkills } }
        );
      } catch {
        /* silent fail (non-critical) */
      }
    }

    // threshold guard
    if (!bestSkill || bestSim < 0.78) continue;

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
      skillSimilarity: bestSim,
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
        similarityScore: bestSim,
      },
      skillsToTeach: teachSkills,
      availabilitySlots: mentorAvailability,
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, 20);
}

module.exports = { findMentorMatchesOpenAI };
