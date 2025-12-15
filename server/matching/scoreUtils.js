// server/matching/scoreUtils.js

/**
 * Cosine similarity between two vectors
 * returns value in range 0..1 (or 0 on invalid input)
 */
function cosineSimilarity(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length === 0 ||
    b.length === 0 ||
    a.length !== b.length
  ) {
    return 0;
  }

  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }

  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;

  const sim = dot / denom;
  return sim < 0 ? 0 : sim > 1 ? 1 : sim;
}

/**
 * Final weighted match score builder
 *
 * Weights rationale:
 * - skillSimilarity (0.6): core of matching
 * - levelScore     (0.2): mentor >= student preference
 * - availability   (0.15): scheduling feasibility
 * - profileQuality (0.05): trust & completeness
 * - multiSkillBonus (0..0.2): additive bonus
 */
function buildMatchScore({
  skillSimilarity,
  levelScore,
  availabilityScore,
  profileQuality,
  multiSkillBonus,
}) {
  const wSkill = 0.6;
  const wLevel = 0.2;
  const wAvail = 0.15;
  const wProfile = 0.05;

  let score =
    wSkill * (Number(skillSimilarity) || 0) +
    wLevel * (Number(levelScore) || 0) +
    wAvail * (Number(availabilityScore) || 0) +
    wProfile * (Number(profileQuality) || 0);

  score += Number(multiSkillBonus) || 0;

  // final clamp (explicit & safe)
  if (Number.isNaN(score)) return 0;
  if (score < 0) return 0;
  if (score > 1) return 1;
  return score;
}

module.exports = { cosineSimilarity, buildMatchScore };
