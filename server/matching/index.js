// server/matching/index.js

const { findMentorMatchesLocal } = require("./localMatcher");
const { findMentorMatchesOpenAI } = require("./openaiMatcher");

/**
 * Normalize mode string
 */
function normalizeMode(raw) {
  const m = String(raw || "")
    .trim()
    .toLowerCase();
  if (m === "local" || m === "openai" || m === "hybrid") return m;
  return null;
}

/**
 * Decide requested mode (priority: request -> env -> local)
 */
function resolveMode(overrideMode) {
  const fromReq = normalizeMode(overrideMode);
  if (fromReq) return fromReq;

  const fromEnv = normalizeMode(process.env.MATCHING_MODE);
  return fromEnv || "local";
}

/**
 * Check OpenAI readiness
 */
function isOpenAIReady() {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  return !!key && key !== "YOUR_KEY_HERE";
}

/**
 * Main matcher entry
 * Always returns: { results, meta }
 */
async function findMentorMatches(params) {
  const requestedMode = resolveMode(params?.mode);
  const openaiReady = isOpenAIReady();

  // ===== OpenAI requested but not ready → fallback =====
  if (
    (requestedMode === "openai" || requestedMode === "hybrid") &&
    !openaiReady
  ) {
    const results = await findMentorMatchesLocal(params);
    return {
      results,
      meta: {
        requestedMode,
        modeUsed: "local",
        fallbackUsed: true,
        reason: "NO_OPENAI_KEY",
      },
    };
  }

  // ===== OpenAI only =====
  if (requestedMode === "openai") {
    const results = await findMentorMatchesOpenAI(params);
    return {
      results,
      meta: {
        requestedMode,
        modeUsed: "openai",
        fallbackUsed: false,
        reason: "OK",
      },
    };
  }

  // ===== Hybrid =====
  if (requestedMode === "hybrid") {
    try {
      const aiResults = await findMentorMatchesOpenAI(params);
      if (Array.isArray(aiResults) && aiResults.length > 0) {
        return {
          results: aiResults,
          meta: {
            requestedMode,
            modeUsed: "openai",
            fallbackUsed: false,
            reason: "OK",
          },
        };
      }

      const localResults = await findMentorMatchesLocal(params);
      return {
        results: localResults,
        meta: {
          requestedMode,
          modeUsed: "local",
          fallbackUsed: true,
          reason: "OPENAI_NO_RESULTS",
        },
      };
    } catch (err) {
      const localResults = await findMentorMatchesLocal(params);
      return {
        results: localResults,
        meta: {
          requestedMode,
          modeUsed: "local",
          fallbackUsed: true,
          reason: "OPENAI_ERROR",
        },
      };
    }
  }

  // ===== Local (default) =====
  const results = await findMentorMatchesLocal(params);
  return {
    results,
    meta: {
      requestedMode,
      modeUsed: "local",
      fallbackUsed: false,
      reason: "OK",
    },
  };
}

module.exports = { findMentorMatches };
