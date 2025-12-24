// server/models/Session.js
const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    // participants
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // what is the session about
    skill: { type: String, required: true, trim: true },
    level: { type: String, default: "Not specified", trim: true },

    // scheduling
    scheduledAt: { type: Date, required: true },

    // lifecycle
    status: {
      type: String,
      enum: ["requested", "accepted", "rejected", "cancelled", "completed"],
      default: "requested",
      index: true,
    },

    // optional notes
    note: { type: String, default: "", trim: true },

    // rating/feedback (optional for later)
    rating: { type: Number, min: 1, max: 5, default: null },
    feedback: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

// Helpful indexes
SessionSchema.index({ mentorId: 1, scheduledAt: 1 });
SessionSchema.index({ learnerId: 1, scheduledAt: 1 });

module.exports = mongoose.model("Session", SessionSchema);
