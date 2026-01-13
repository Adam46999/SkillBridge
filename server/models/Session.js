// server/models/Session.js
const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
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

    skill: { type: String, required: true, trim: true },
    level: { type: String, default: "Not specified", trim: true },

    scheduledAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["requested", "accepted", "rejected", "cancelled", "completed"],
      default: "requested",
      index: true,
    },

    joinedAt: { type: Date, default: null },
    joinedBy: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] },
    ],

    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // ✅ cancellation meta
    cancelReason: { type: String, default: "", trim: true },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ✅ message for the other side when someone "deletes"
    deleteNotice: { type: String, default: "", trim: true },

    // ✅ Soft delete (hide for me)
    hiddenFor: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] },
    ],

    note: { type: String, default: "", trim: true },

    // legacy/simple rating (kept)
    rating: { type: Number, min: 1, max: 5, default: null },
    feedback: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

SessionSchema.index({ mentorId: 1, scheduledAt: 1 });
SessionSchema.index({ learnerId: 1, scheduledAt: 1 });
SessionSchema.index({ hiddenFor: 1, scheduledAt: -1 });

module.exports = mongoose.model("Session", SessionSchema);
