// server/routes/users.js
const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function toPublicUser(u) {
  return {
    id: String(u._id),
    fullName: u.fullName,
    points: u.points,
    xp: u.xp,
    streak: u.streak,
    avgRating: u.avgRating,
    ratingCount: u.ratingCount,
    skillsToTeach: u.skillsToTeach || [],
    availabilitySlots: u.availabilitySlots || [],
    preferences: u.preferences || { communicationModes: [], languages: [] },
  };
}

module.exports = function usersRouter(authMiddleware) {
  const router = express.Router();

  // GET /api/users/:id
  router.get("/:id", authMiddleware, async (req, res) => {
    try {
      const id = String(req.params.id);
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const u = await User.findById(id).select(
        "fullName points xp streak avgRating ratingCount skillsToTeach availabilitySlots preferences"
      );

      if (!u) return res.status(404).json({ error: "User not found" });

      return res.json(toPublicUser(u));
    } catch (err) {
      console.error("GET PUBLIC USER ERROR:", err);
      return res.status(500).json({ error: "Failed to load user profile" });
    }
  });

  return router;
};
