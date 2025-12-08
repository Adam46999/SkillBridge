const mongoose = require("mongoose");

const AvailabilitySlotSchema = new mongoose.Schema({
  dayOfWeek: Number, // 0-6
  from: String, // "18:00"
  to: String, // "19:00"
});

const SkillTeachSchema = new mongoose.Schema({
  name: String, // "Beginner Programming"
  level: String, // "Beginner" / "Intermediate" / "Advanced"
});

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },

    skillsToLearn: [String],
    skillsToTeach: [SkillTeachSchema],

    points: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },

    avgRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    availabilitySlots: [AvailabilitySlotSchema],

    preferences: {
      communicationModes: [String], // ["chat","voice","screen"]
      languages: [String], // ["en","he","ar"]
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
