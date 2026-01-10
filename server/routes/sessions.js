// server/routes/sessions.js
const express = require("express");
const mongoose = require("mongoose");
const Session = require("../models/Session");

// ✅ points + rules
const {
  getBalance,
  addPoints,
  deductPoints,
} = require("../services/pointsService");
const { POINTS, CANCEL, REASONS } = require("../services/gamificationRules");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function pickUser(u) {
  if (!u) return null;
  return {
    _id: u._id,
    fullName: u.fullName,
    email: u.email,
    points: u.points,
    xp: u.xp,
    streak: u.streak,
    avgRating: u.avgRating,
    ratingCount: u.ratingCount,
  };
}

async function populateSession(id) {
  const populated = await Session.findById(id)
    .populate(
      "mentorId",
      "fullName email points xp streak avgRating ratingCount"
    )
    .populate(
      "learnerId",
      "fullName email points xp streak avgRating ratingCount"
    );

  if (!populated) return null;

  return {
    ...populated.toObject(),
    mentor: pickUser(populated.mentorId),
    learner: pickUser(populated.learnerId),
  };
}

// Normalize API spelling to DB spelling
function normalizeStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "canceled") return "cancelled"; // accept US spelling
  return s;
}

function canTransition(current, next) {
  // conservative rules
  if (next === "accepted" || next === "rejected")
    return current === "requested";
  if (next === "completed") return current === "accepted";
  if (next === "cancelled") return current !== "completed";
  return false;
}

function toMs(v) {
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return t;
}

function isTimeReached(when) {
  const t = toMs(when);
  if (!t) return false;
  return t <= Date.now();
}

function minutesUntil(when) {
  const t = toMs(when);
  if (!t) return null;
  const diff = t - Date.now();
  return Math.floor(diff / 60000);
}

function isLateCancel(scheduledAt) {
  const mins = minutesUntil(scheduledAt);
  if (mins === null) return false;
  // late cancel = scheduled in the future AND within window
  return mins >= 0 && mins <= Number(CANCEL?.LATE_WINDOW_MINUTES ?? 120);
}

module.exports = function sessionsRouter(authMiddleware) {
  const router = express.Router();

  // ============================================================
  // INTERNAL: safe status updater used by all endpoints
  // - includes points economy side-effects (accept/complete/cancel-late)
  // ============================================================
  async function updateStatusInternal(req, res, nextStatusRaw) {
    const userId = String(req.userId);
    const id = String(req.params.id);
    const nextStatus = normalizeStatus(nextStatusRaw);

    const allowed = new Set(["accepted", "rejected", "cancelled", "completed"]);
    if (!allowed.has(nextStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid session id" });
    }

    let s;
    try {
      s = await Session.findById(id);
    } catch (err) {
      console.error("FIND SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to load session" });
    }
    if (!s) return res.status(404).json({ error: "Session not found" });

    const isMentor = String(s.mentorId) === userId;
    const isLearner = String(s.learnerId) === userId;
    if (!isMentor && !isLearner) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const currentStatus = normalizeStatus(s.status);

    // Idempotent: if same status, return populated session (no points side-effects)
    if (currentStatus === nextStatus) {
      const session = await populateSession(id);
      return res.json({ session, ok: true, unchanged: true });
    }

    // Role rules
    if (nextStatus === "accepted" || nextStatus === "rejected") {
      if (!isMentor) return res.status(403).json({ error: "Mentor only" });
    }

    // Complete: mentor only + after time reached
    if (nextStatus === "completed") {
      if (!isMentor) return res.status(403).json({ error: "Mentor only" });
      if (!isTimeReached(s.scheduledAt)) {
        return res.status(400).json({
          error: "You can complete only after the scheduled time is reached",
        });
      }
    }

    // Transition rules
    if (!canTransition(currentStatus, nextStatus)) {
      if (nextStatus === "accepted" || nextStatus === "rejected") {
        return res
          .status(400)
          .json({ error: "Can only accept/reject requested sessions" });
      }
      if (nextStatus === "completed") {
        return res
          .status(400)
          .json({ error: "Only accepted sessions can be completed" });
      }
      if (nextStatus === "cancelled") {
        return res
          .status(400)
          .json({ error: "Cannot cancel completed session" });
      }
      return res.status(400).json({ error: "Invalid status transition" });
    }

    // ============================================================
    // ✅ POINTS SIDE-EFFECTS (safe + minimal risk)
    //
    // Rules:
    // - On ACCEPT (mentor accepts): learner pays BOOK_LEARN_SESSION_COST
    // - On COMPLETE: mentor gets TEACH_SESSION_REWARD
    // - On CANCEL (late): canceller pays CANCEL_LATE_PENALTY (optional rule)
    //
    // Important:
    // - We try to avoid mismatch by:
    //   - pre-checking balance for learner before accept
    //   - reverting status if points action fails unexpectedly
    // ============================================================

    // 1) Pre-check for ACCEPT: learner must have enough points
    if (currentStatus === "requested" && nextStatus === "accepted") {
      try {
        const learnerId = String(s.learnerId);
        const cost = Number(POINTS?.BOOK_LEARN_SESSION_COST ?? 10);

        const bal = await getBalance(learnerId);
        if (bal < cost) {
          return res.status(400).json({
            error: "Not enough points to book this session",
            needed: cost,
            balance: bal,
          });
        }
      } catch (err) {
        console.error("ACCEPT PRECHECK ERROR:", err);
        return res.status(500).json({ error: "Failed to validate points" });
      }
    }

    // 2) Apply status update first (but revert if points later fails)
    const prevStatus = currentStatus;
    try {
      s.status = nextStatus;
      await s.save();
    } catch (err) {
      console.error("SAVE STATUS ERROR:", err);
      return res.status(500).json({ error: "Failed to update session status" });
    }

    // 3) Apply points side-effects
    try {
      // ACCEPT: deduct from learner
      if (prevStatus === "requested" && nextStatus === "accepted") {
        const learnerId = String(s.learnerId);
        const cost = Number(POINTS?.BOOK_LEARN_SESSION_COST ?? 10);

        await deductPoints(
          learnerId,
          cost,
          REASONS?.LEARN_SESSION_BOOKED || "learn_session_booked",
          s._id
        );
      }

      // COMPLETE: reward mentor
      if (prevStatus === "accepted" && nextStatus === "completed") {
        const mentorId = String(s.mentorId);
        const reward = Number(POINTS?.TEACH_SESSION_REWARD ?? 10);

        await addPoints(
          mentorId,
          reward,
          REASONS?.TEACH_SESSION_COMPLETED || "teach_session_completed",
          s._id
        );
      }

      // CANCELLED: late cancel penalty on who cancelled
      if (nextStatus === "cancelled") {
        // penalty only if it was accepted/requested (not completed) and late
        const wasActive =
          prevStatus === "accepted" || prevStatus === "requested";
        if (wasActive && isLateCancel(s.scheduledAt)) {
          const penalty = Number(POINTS?.CANCEL_LATE_PENALTY ?? 2);

          // charge the canceller (current user)
          await deductPoints(
            userId,
            penalty,
            REASONS?.CANCEL_LATE || "cancel_late",
            s._id
          );
        }
      }
    } catch (err) {
      // If points action fails, revert status to previous
      // (best-effort to keep system consistent)
      console.error("POINTS SIDE-EFFECT ERROR:", err);

      try {
        const fresh = await Session.findById(id);
        if (fresh && normalizeStatus(fresh.status) === nextStatus) {
          fresh.status = prevStatus;
          await fresh.save();
        }
      } catch (revertErr) {
        console.error("STATUS REVERT ERROR:", revertErr);
      }

      return res.status(400).json({
        error: err?.message || "Points rule failed",
      });
    }

    // return populated session
    const session = await populateSession(id);
    return res.json({ session, ok: true });
  }

  // ===============================
  // CREATE SESSION (learner requests)
  // POST /api/sessions
  // body: { mentorId, skill, level?, scheduledAt, note? }
  // ===============================
  router.post("/", authMiddleware, async (req, res) => {
    try {
      const learnerId = String(req.userId);
      const { mentorId, skill, level, scheduledAt, note } = req.body || {};

      if (!mentorId || !skill || !scheduledAt) {
        return res.status(400).json({
          error: "mentorId, skill, scheduledAt are required",
        });
      }

      if (!isValidObjectId(mentorId) || !isValidObjectId(learnerId)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ error: "Invalid scheduledAt date" });
      }

      const doc = await Session.create({
        mentorId,
        learnerId,
        skill: String(skill).trim(),
        level: String(level || "Not specified").trim(),
        scheduledAt: when,
        note: String(note || "").trim(),
        status: "requested",
      });

      const session = await populateSession(doc._id);
      return res.json({ session });
    } catch (err) {
      console.error("CREATE SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to create session" });
    }
  });

  // ===============================
  // LIST MY SESSIONS
  // GET /api/sessions/mine?role=any|mentor|learner&scope=upcoming|past|all&statuses=requested,accepted
  // ===============================
  router.get("/mine", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);

      const roleRaw = String(req.query.role || "any").trim();
      const role = roleRaw === "all" ? "any" : roleRaw;

      const scope = String(req.query.scope || "all").trim();
      const statusesCsv = String(
        req.query.statuses || req.query.status || ""
      ).trim();

      const now = new Date();
      const q = {};

      if (role === "mentor") q.mentorId = userId;
      else if (role === "learner") q.learnerId = userId;
      else q.$or = [{ mentorId: userId }, { learnerId: userId }];

      if (scope === "upcoming") q.scheduledAt = { $gte: now };
      else if (scope === "past") q.scheduledAt = { $lt: now };

      if (statusesCsv) {
        const statuses = statusesCsv
          .split(",")
          .map((st) => normalizeStatus(st))
          .map((st) => st.trim())
          .filter(Boolean);

        if (statuses.length) q.status = { $in: statuses };
      }

      const list = await Session.find(q)
        .sort({ scheduledAt: 1 })
        .populate(
          "mentorId",
          "fullName email points xp streak avgRating ratingCount"
        )
        .populate(
          "learnerId",
          "fullName email points xp streak avgRating ratingCount"
        );

      const out = list.map((x) => ({
        ...x.toObject(),
        mentor: pickUser(x.mentorId),
        learner: pickUser(x.learnerId),
      }));

      return res.json({ sessions: out });
    } catch (err) {
      console.error("LIST SESSIONS ERROR:", err);
      return res.status(500).json({ error: "Failed to list sessions" });
    }
  });

  // ============================================================
  // PATCH /api/sessions/:id/status { status }
  // ============================================================
  router.patch("/:id/status", authMiddleware, async (req, res) => {
    return updateStatusInternal(req, res, req.body?.status);
  });

  // ============================================================
  // SAFE ENDPOINTS (additive)
  // ============================================================
  router.post("/:id/accept", authMiddleware, async (req, res) => {
    return updateStatusInternal(req, res, "accepted");
  });

  router.post("/:id/reject", authMiddleware, async (req, res) => {
    return updateStatusInternal(req, res, "rejected");
  });

  router.post("/:id/cancel", authMiddleware, async (req, res) => {
    return updateStatusInternal(req, res, "cancelled");
  });

  router.post("/:id/complete", authMiddleware, async (req, res) => {
    return updateStatusInternal(req, res, "completed");
  });

  // ===============================
  // RATE SESSION
  // POST /api/sessions/:id/rate  { rating, feedback }
  // ===============================
  router.post("/:id/rate", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      const rating = Number(req.body?.rating);
      const feedback = String(req.body?.feedback || "").trim();

      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ error: "rating must be between 1 and 5" });
      }

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const isMentor = String(s.mentorId) === userId;
      const isLearner = String(s.learnerId) === userId;
      if (!isMentor && !isLearner)
        return res.status(403).json({ error: "Not allowed" });

      if (normalizeStatus(s.status) !== "completed") {
        return res
          .status(400)
          .json({ error: "You can rate only completed sessions" });
      }

      if (s.rating) {
        return res.status(400).json({ error: "Session already rated" });
      }

      s.rating = Math.round(rating);
      s.feedback = feedback;
      await s.save();

      const session = await populateSession(id);
      return res.json({ ok: true, session });
    } catch (err) {
      console.error("RATE SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to rate session" });
    }
  });

  return router;
};
