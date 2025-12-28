// server/routes/ratings.js
const express = require("express");
const mongoose = require("mongoose");

const Rating = require("../models/Rating");
const Session = require("../models/Session");
const User = require("../models/User");

module.exports = function ratingsRouter(authMiddleware) {
  const router = express.Router();

  // POST /api/ratings
  router.post("/", authMiddleware, async (req, res) => {
    try {
      const fromUserId = String(req.userId);
      const { sessionId, score, comment } = req.body || {};

      if (!sessionId || !score) {
        return res.status(400).json({
          error: "sessionId and score are required",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({ error: "Invalid session id" });
      }

      const s = await Session.findById(sessionId);
      if (!s) return res.status(404).json({ error: "Session not found" });

      if (s.status !== "completed") {
        return res.status(400).json({
          error: "You can rate only completed sessions",
        });
      }

      const isLearner = String(s.learnerId) === fromUserId;
      const isMentor = String(s.mentorId) === fromUserId;

      if (!isLearner && !isMentor) {
        return res.status(403).json({ error: "Not allowed" });
      }

      const toUserId = isLearner ? s.mentorId : s.learnerId;

      const rating = await Rating.create({
        sessionId,
        fromUserId,
        toUserId,
        score,
        comment: String(comment || "").trim(),
      });

      // ===== Gamification =====
      const receiver = await User.findById(toUserId);

      receiver.ratingCount += 1;
      receiver.ratingAvg =
        (receiver.ratingAvg * (receiver.ratingCount - 1) + score) /
        receiver.ratingCount;

      // bonus for good rating
      if (score >= 4) {
        receiver.points += 2; // 📘 book: +2 bonus
        receiver.xp += 10;
      }

      await receiver.save();

      return res.json({
        rating,
        updatedUser: {
          _id: receiver._id,
          ratingAvg: receiver.ratingAvg,
          ratingCount: receiver.ratingCount,
          points: receiver.points,
          xp: receiver.xp,
        },
      });
    } catch (err) {
      console.error("RATE SESSION ERROR:", err);
      return res.status(500).json({
        error: "Failed to submit rating",
        details: err instanceof Error ? err.message : "Unknown server error",
      });
    }
  });

  return router;
};
