// server/matching/index.js
const { findMentorMatchesLocal } = require("./localMatcher");
const { findMentorMatchesOpenAI } = require("./openaiMatcher");

function normalizeMode(raw) {
  const m = String(raw || "")
    .trim()
    .toLowerCase();
  if (m === "openai" || m === "local" || m === "hybrid") return m;
  return null;
}

function getMode(overrideMode) {
  const fromOverride = normalizeMode(overrideMode);
  if (fromOverride) return fromOverride;

  const fromEnv = normalizeMode(process.env.MATCHING_MODE);
  return fromEnv || "local";
}

function isOpenAIReady() {
  const raw = String(process.env.OPENAI_API_KEY || "").trim();
  return !!raw && raw !== "YOUR_KEY_HERE";
}

function metaBase({ requestedMode, modeUsed, fallbackUsed, reason = "OK" }) {
  return {
    requestedMode: requestedMode || null,
    modeUsed: modeUsed || null,
    fallbackUsed: !!fallbackUsed,
    reason, // OK | NO_KEY | OPENAI_EMPTY | OPENAI_ERROR
  };
}

/**
 * modes:
 * - local
 * - openai
 * - hybrid (openai then fallback to local)
 *
 * Returns:
 * { results: MentorMatch[], meta: { requestedMode, modeUsed, fallbackUsed, reason } }
 */
async function findMentorMatches(params) {
  const requestedMode = normalizeMode(params?.mode) || null;
  const mode = getMode(params?.mode);

  // -------- LOCAL --------
  if (mode === "local") {
    const results = await findMentorMatchesLocal(params);
    return {
      results,
      meta: metaBase({
        requestedMode,
        modeUsed: "local",
        fallbackUsed: false,
        reason: "OK",
      }),
    };
  }

  // -------- OPENAI --------
  if (mode === "openai") {
    // لو ما في key، ما بنفجر السيرفر، بنرجع نتائج فاضية + سبب واضح
    if (!isOpenAIReady()) {
      return {
        results: [],
        meta: metaBase({
          requestedMode,
          modeUsed: "openai",
          fallbackUsed: false,
          reason: "NO_KEY",
        }),
      };
    }

    try {
      const results = await findMentorMatchesOpenAI(params);
      return {
        results: Array.isArray(results) ? results : [],
        meta: metaBase({
          requestedMode,
          modeUsed: "openai",
          fallbackUsed: false,
          reason: results && results.length ? "OK" : "OPENAI_EMPTY",
        }),
      };
    } catch (e) {
      console.log("OPENAI mode failed:", e?.message || e);
      return {
        results: [],
        meta: metaBase({
          requestedMode,
          modeUsed: "openai",
          fallbackUsed: false,
          reason: "OPENAI_ERROR",
        }),
      };
    }
  }

  // -------- HYBRID --------
  // OpenAI ثم fallback إلى Local إذا فشل/فاضي/ما في key
  if (mode === "hybrid") {
    if (!isOpenAIReady()) {
      const local = await findMentorMatchesLocal(params);
      return {
        results: local,
        meta: metaBase({
          requestedMode,
          modeUsed: "local",
          fallbackUsed: true,
          reason: "NO_KEY",
        }),
      };
    }

    try {
      const ai = await findMentorMatchesOpenAI(params);
      if (Array.isArray(ai) && ai.length > 0) {
        return {
          results: ai,
          meta: metaBase({
            requestedMode,
            modeUsed: "openai",
            fallbackUsed: false,
            reason: "OK",
          }),
        };
      }

      const local = await findMentorMatchesLocal(params);
      return {
        results: local,
        meta: metaBase({
          requestedMode,
          modeUsed: "local",
          fallbackUsed: true,
          reason: "OPENAI_EMPTY",
        }),
      };
    } catch (e) {
      console.log("HYBRID: OpenAI failed -> fallback local:", e?.message || e);
      const local = await findMentorMatchesLocal(params);
      return {
        results: local,
        meta: metaBase({
          requestedMode,
          modeUsed: "local",
          fallbackUsed: true,
          reason: "OPENAI_ERROR",
        }),
      };
    }
  }

  // -------- SAFETY FALLBACK --------
  const results = await findMentorMatchesLocal(params);
  return {
    results,
    meta: metaBase({
      requestedMode,
      modeUsed: "local",
      fallbackUsed: true,
      reason: "OK",
    }),
  };
}

module.exports = { findMentorMatches };
