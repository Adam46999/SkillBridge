const mongoose = require("mongoose");

const AvailabilitySlotSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    from: { type: String, required: true },
    to: { type: String, required: true },
  },
  { _id: false }
);

const SkillTeachSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    level: { type: String, default: "Not specified" },
    embedding: { type: [Number], default: undefined },
  },
  { _id: false }
);

const SkillLearnSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    level: { type: String, default: "Not specified" },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },

    skillsToLearn: { type: [SkillLearnSchema], default: [] },
    skillsToTeach: { type: [SkillTeachSchema], default: [] },

    // 🎮 Gamification
    points: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },

    // ⭐ Ratings
    avgRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    availabilitySlots: { type: [AvailabilitySlotSchema], default: [] },

    preferences: {
      communicationModes: { type: [String], default: [] },
      languages: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
