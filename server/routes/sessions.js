// server/routes/sessions.js
const express = require("express");
const mongoose = require("mongoose");
const Session = require("../models/Session");
const User = require("../models/User");

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

module.exports = function sessionsRouter(authMiddleware) {
  const router = express.Router();

  // ===============================
  // CREATE SESSION (learner requests)
  // POST /api/sessions
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

      const populated = await Session.findById(doc._id)
        .populate(
          "mentorId",
          "fullName email points xp streak avgRating ratingCount"
        )
        .populate(
          "learnerId",
          "fullName email points xp streak avgRating ratingCount"
        );

      return res.json({
        session: {
          ...populated.toObject(),
          mentor: pickUser(populated.mentorId),
          learner: pickUser(populated.learnerId),
        },
      });
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
          .map((s) => s.trim())
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

      const out = list.map((s) => ({
        ...s.toObject(),
        mentor: pickUser(s.mentorId),
        learner: pickUser(s.learnerId),
      }));

      return res.json({ sessions: out });
    } catch (err) {
      console.error("LIST SESSIONS ERROR:", err);
      return res.status(500).json({ error: "Failed to list sessions" });
    }
  });

  // ===============================
  // UPDATE SESSION STATUS
  // PATCH /api/sessions/:id/status { status }
  // ===============================
  router.patch("/:id/status", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      const nextStatus = String(req.body?.status || "").trim();

      const allowed = new Set([
        "accepted",
        "rejected",
        "cancelled",
        "completed",
      ]);
      if (!allowed.has(nextStatus)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid session id" });
      }

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const isMentor = String(s.mentorId) === userId;
      const isLearner = String(s.learnerId) === userId;
      if (!isMentor && !isLearner) {
        return res.status(403).json({ error: "Not allowed" });
      }

      // rules
      if (nextStatus === "accepted" || nextStatus === "rejected") {
        if (!isMentor) return res.status(403).json({ error: "Mentor only" });
        if (s.status !== "requested") {
          return res.status(400).json({
            error: "Can only accept/reject requested sessions",
          });
        }
      }

      if (nextStatus === "completed") {
        if (s.status !== "accepted") {
          return res.status(400).json({
            error: "Only accepted sessions can be completed",
          });
        }
      }

      if (nextStatus === "cancelled") {
        if (s.status === "completed") {
          return res
            .status(400)
            .json({ error: "Cannot cancel completed session" });
        }
      }

      s.status = nextStatus;
      await s.save();

      // OPTIONAL gamification: keep or delete حسب البوك عندك
      // if (nextStatus === "completed") {
      //   const mentor = await User.findById(s.mentorId);
      //   const learner = await User.findById(s.learnerId);
      //   if (mentor) { mentor.points += 10; mentor.xp += 25; mentor.streak += 1; await mentor.save(); }
      //   if (learner) { learner.xp += 10; await learner.save(); }
      // }

      const populated = await Session.findById(id)
        .populate(
          "mentorId",
          "fullName email points xp streak avgRating ratingCount"
        )
        .populate(
          "learnerId",
          "fullName email points xp streak avgRating ratingCount"
        );

      return res.json({
        session: {
          ...populated.toObject(),
          mentor: pickUser(populated.mentorId),
          learner: pickUser(populated.learnerId),
        },
      });
    } catch (err) {
      console.error("UPDATE SESSION STATUS ERROR:", err);
      return res.status(500).json({ error: "Failed to update session status" });
    }
  });

  // ===============================
  // RATE SESSION (for your SessionCard)
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

      if (s.status !== "completed") {
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

      return res.json({ ok: true, session: s });
    } catch (err) {
      console.error("RATE SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to rate session" });
    }
  });

  return router;
};
