// server/models/PointTransaction.js
const mongoose = require("mongoose");

const PointTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true, // + or -
    },

    reason: {
      type: String,
      required: true, // e.g. "teach_session", "learn_session"
    },

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PointTransaction", PointTransactionSchema);
