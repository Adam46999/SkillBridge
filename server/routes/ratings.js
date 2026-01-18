// server/routes/ratings.js
const express = require("express");
const mongoose = require("mongoose");
const Rating = require("../models/Rating");
const User = require("../models/User");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

module.exports = function ratingsRouter(authMiddleware) {
  const router = express.Router();

  /**
   * GET /api/ratings/user/:userId
   * Get all ratings received by a user (for profile page)
   */
  router.get("/user/:userId", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.params.userId);

      if (!isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const ratings = await Rating.find({ toUserId: userId })
        .populate("fromUserId", "fullName")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const formatted = ratings.map((r) => ({
        id: String(r._id),
        score: r.score,
        comment: r.comment || "",
        fromUser: {
          id: String(r.fromUserId._id),
          fullName: r.fromUserId.fullName || "Unknown",
        },
        createdAt: r.createdAt,
      }));

      return res.json(formatted);
    } catch (err) {
      console.error("GET USER RATINGS ERROR:", err);
      return res.status(500).json({ error: "Failed to load ratings" });
    }
  });

  return router;
};

