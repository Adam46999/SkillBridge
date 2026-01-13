// server/routes/users.js
const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function toPublicUser(u) {
  if (!u) return null;

  return {
    id: String(u._id),
    fullName: String(u.fullName || ""),
    points: Number(u.points || 0),
    xp: Number(u.xp || 0),
    streak: Number(u.streak || 0),

    // ratings
    avgRating: Number(u.avgRating || 0),
    ratingCount: Number(u.ratingCount || 0),

    // profile info
    skillsToTeach: Array.isArray(u.skillsToTeach) ? u.skillsToTeach : [],
    availabilitySlots: Array.isArray(u.availabilitySlots)
      ? u.availabilitySlots
      : [],
    preferences:
      u.preferences && typeof u.preferences === "object"
        ? {
            communicationModes: Array.isArray(u.preferences.communicationModes)
              ? u.preferences.communicationModes
              : [],
            languages: Array.isArray(u.preferences.languages)
              ? u.preferences.languages
              : [],
          }
        : { communicationModes: [], languages: [] },
  };
}

module.exports = function usersRouter(authMiddleware) {
  const router = express.Router();

  /**
   * GET /api/users/:id
   * Public mentor profile (for mentor page)
   */
  router.get("/:id", authMiddleware, async (req, res) => {
    try {
      const id = String(req.params.id);

      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const u = await User.findById(id)
        .select(
          "fullName points xp streak avgRating ratingCount skillsToTeach availabilitySlots preferences"
        )
        .lean();

      if (!u) return res.status(404).json({ error: "User not found" });

      return res.json(toPublicUser(u));
    } catch (err) {
      console.error("GET PUBLIC USER ERROR:", err);
      return res.status(500).json({ error: "Failed to load user profile" });
    }
  });

  return router;
};
