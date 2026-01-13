// server/models/Conversation.js
const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    // 1-to-1 only
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length === 2;
        },
        message: "Conversation must have exactly 2 participants",
      },
      index: true,
    },

    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Helpful indexes for inbox queries
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
