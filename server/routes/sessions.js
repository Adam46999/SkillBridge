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

// ✅ ratings service (fix rating reflection)
const { rateSession } = require("../services/ratingsService");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

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

function minutesSince(when) {
  const t = toMs(when);
  if (!t) return null;
  const diff = Date.now() - t;
  return Math.floor(diff / 60000);
}

function isLateCancel(scheduledAt) {
  const mins = minutesUntil(scheduledAt);
  if (mins === null) return false;
  // late cancel = scheduled in the future AND within window
  return mins >= 0 && mins <= Number(CANCEL?.LATE_WINDOW_MINUTES ?? 120);
}

// ✅ Time Rules (centralized)
const RULES = {
  // Accept/Reject should not happen once time reached
  ACCEPT_REJECT_BLOCK_AT_START: true,

  // Join window
  JOIN_EARLY_MIN: 30, // can join 30 min before
  JOIN_LATE_MIN: 180, // can join up to 3 hours after

  // Complete window
  COMPLETE_MAX_DELAY_MIN: 24 * 60, // 24 hours after scheduledAt
};

function canJoinNow(sessionDoc) {
  const until = minutesUntil(sessionDoc.scheduledAt);
  if (until === null) return { ok: false, reason: "Invalid scheduledAt" };

  // until > 0 means future
  // allow join if (future and within early window) OR (past but within late window)
  if (until > 0 && until <= RULES.JOIN_EARLY_MIN) return { ok: true };
  if (until <= 0) {
    const since = minutesSince(sessionDoc.scheduledAt);
    if (since !== null && since <= RULES.JOIN_LATE_MIN) return { ok: true };
  }
  return { ok: false, reason: "Join window is closed" };
}

function canCompleteNow(sessionDoc) {
  if (!isTimeReached(sessionDoc.scheduledAt)) {
    return { ok: false, reason: "Too early to complete" };
  }
  const since = minutesSince(sessionDoc.scheduledAt);
  if (since === null) return { ok: false, reason: "Invalid scheduledAt" };
  if (since > RULES.COMPLETE_MAX_DELAY_MIN) {
    return { ok: false, reason: "Completion window expired" };
  }
  return { ok: true };
}

function pickUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    fullName: String(u.fullName || ""),
    email: String(u.email || ""),
    points: Number(u.points || 0),
    xp: Number(u.xp || 0),
    streak: Number(u.streak || 0),
    avgRating: Number(u.avgRating || 0),
    ratingCount: Number(u.ratingCount || 0),
  };
}

async function populateSession(id) {
  const s = await Session.findById(id)
    .populate(
      "mentorId",
      "fullName email points xp streak avgRating ratingCount"
    )
    .populate(
      "learnerId",
      "fullName email points xp streak avgRating ratingCount"
    );

  if (!s) return null;

  const o = s.toObject();
  return {
    ...o,
    mentor: pickUser(o.mentorId),
    learner: pickUser(o.learnerId),
  };
}

module.exports = function sessionsRouter(authMiddleware) {
  const router = express.Router();

  // ============================================================
  // INTERNAL: safe status updater used by all endpoints
  // - includes points economy side-effects (accept/complete/cancel-late)
  // ============================================================
  async function updateStatusInternal(req, res, statusRaw) {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      const nextStatus = normalizeStatus(statusRaw);

      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      if (!nextStatus) return res.status(400).json({ error: "Missing status" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);

      const isMentor = mentorId === userId;
      const isLearner = learnerId === userId;

      if (!isMentor && !isLearner) {
        return res.status(403).json({ error: "Not allowed" });
      }

      const currentStatus = String(s.status);

      // Idempotent: if same status, return populated session (no points side-effects)
      if (currentStatus === nextStatus) {
        const session = await populateSession(id);
        return res.json({ session, ok: true, unchanged: true });
      }

      // Role rules
      if (nextStatus === "accepted" || nextStatus === "rejected") {
        if (!isMentor) return res.status(403).json({ error: "Mentor only" });

        // ✅ Level-0 fix: block accept/reject after time reached
        if (
          RULES.ACCEPT_REJECT_BLOCK_AT_START &&
          isTimeReached(s.scheduledAt)
        ) {
          return res.status(400).json({
            error: "You cannot accept/reject after the session time is reached",
          });
        }
      }

      // Complete: mentor only + after time reached + within window + join required
      if (nextStatus === "completed") {
        if (!isMentor) return res.status(403).json({ error: "Mentor only" });

        const okTime = canCompleteNow(s);
        if (!okTime.ok) {
          return res.status(400).json({
            error: `Cannot complete: ${okTime.reason}`,
          });
        }

        // ✅ Level-0 fix: require mentor joined (attendance)
        const joinedBy = Array.isArray(s.joinedBy)
          ? s.joinedBy.map(String)
          : [];
        if (!s.joinedAt || !joinedBy.includes(mentorId)) {
          return res.status(400).json({
            error:
              "Cannot complete: mentor must join the session before completing",
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
            .json({ error: "Can only complete accepted sessions" });
        }
        if (nextStatus === "cancelled") {
          return res
            .status(400)
            .json({ error: "Invalid cancellation transition" });
        }
        return res.status(400).json({ error: "Invalid status transition" });
      }

      // Accept precheck: learner must have points
      if (currentStatus === "requested" && nextStatus === "accepted") {
        try {
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

      // Apply status update first (but revert if points fail)
      const prevStatus = currentStatus;
      try {
        s.status = nextStatus;

        // timestamps (best-effort, additive)
        if (nextStatus === "completed") s.completedAt = new Date();
        if (nextStatus === "cancelled") s.cancelledAt = new Date();

        await s.save();
      } catch (err) {
        console.error("SAVE STATUS ERROR:", err);
        return res
          .status(500)
          .json({ error: "Failed to update session status" });
      }

      // Apply points side-effects (idempotent now)
      try {
        // ACCEPT: deduct from learner
        if (prevStatus === "requested" && nextStatus === "accepted") {
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
          const wasActive =
            prevStatus === "accepted" || prevStatus === "requested";
          if (wasActive && isLateCancel(s.scheduledAt)) {
            const penalty = Number(POINTS?.CANCEL_LATE_PENALTY ?? 2);

            await deductPoints(
              userId,
              penalty,
              REASONS?.CANCEL_LATE || "cancel_late",
              s._id
            );
          }
        }
      } catch (err) {
        console.error("POINTS SIDE-EFFECT ERROR:", err);

        // revert status if points failed
        try {
          const fresh = await Session.findById(id);
          if (fresh) {
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
    } catch (err) {
      console.error("UPDATE STATUS ERROR:", err);
      return res.status(500).json({ error: "Failed to update session status" });
    }
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

      if (!isValidObjectId(mentorId)) {
        return res.status(400).json({ error: "Invalid mentorId" });
      }

      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ error: "Invalid scheduledAt" });
      }

      const s = await Session.create({
        mentorId,
        learnerId,
        skill: String(skill).trim(),
        level: String(level || "Not specified").trim(),
        scheduledAt: when,
        note: String(note || "").trim(),
        status: "requested",
      });

      const session = await populateSession(s._id);
      return res.json({ ok: true, session });
    } catch (err) {
      console.error("CREATE SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to create session" });
    }
  });

  // ===============================
  // LIST MY SESSIONS
  // GET /api/sessions/mine
  // ===============================
  router.get("/mine", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);

      const list = await Session.find({
        $or: [{ mentorId: userId }, { learnerId: userId }],
      })
        .sort({ scheduledAt: -1 })
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

  // ============================================================
  // ✅ JOIN SESSION (new, additive)
  // POST /api/sessions/:id/join
  // - marks joinedAt
  // - records joinedBy (mentor/learner)
  // - used to gate completion
  // ============================================================
  router.post("/:id/join", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);

      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);

      const isMentor = mentorId === userId;
      const isLearner = learnerId === userId;

      if (!isMentor && !isLearner) {
        return res.status(403).json({ error: "Not allowed" });
      }

      if (String(s.status) !== "accepted") {
        return res
          .status(400)
          .json({ error: "Can join only accepted sessions" });
      }

      const ok = canJoinNow(s);
      if (!ok.ok) {
        return res.status(400).json({ error: `Cannot join: ${ok.reason}` });
      }

      // set joinedAt once
      if (!s.joinedAt) s.joinedAt = new Date();

      // ensure joinedBy contains user
      const joinedBy = Array.isArray(s.joinedBy) ? s.joinedBy.map(String) : [];
      if (!joinedBy.includes(userId)) {
        s.joinedBy = [...(s.joinedBy || []), userId];
      }

      await s.save();

      const session = await populateSession(id);
      return res.json({ ok: true, session });
    } catch (err) {
      console.error("JOIN SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to join session" });
    }
  });

  // ===============================
  // RATE SESSION (FIXED)
  // POST /api/sessions/:id/rate  { rating, feedback }
  // - uses ratingsService so avgRating/ratingCount update immediately
  // ===============================
  router.post("/:id/rate", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);

      const rating = Number(req.body?.rating);
      const feedback = String(req.body?.feedback || "").trim();

      const result = await rateSession({
        sessionId: id,
        fromUserId: userId,
        score: rating,
        comment: feedback,
      });

      // Keep returning the same shape your app already expects:
      // { ok: true, session }
      const session = await populateSession(id);
      return res.json({
        ok: true,
        session,
        // extra info (safe additive)
        ratedUser: result?.updatedUser || null,
        rating: result?.rating || null,
      });
    } catch (err) {
      const status = Number(err?.status || 500);
      console.error("RATE SESSION ERROR:", err);
      return res
        .status(status)
        .json({ error: err?.message || "Failed to rate session" });
    }
  });

  return router;
};
