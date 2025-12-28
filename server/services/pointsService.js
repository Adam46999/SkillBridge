// server/services/pointsService.js
const mongoose = require("mongoose");
const User = require("../models/User");
const PointTransaction = require("../models/PointTransaction");

async function getBalance(userId) {
  const user = await User.findById(userId).select("points");
  if (!user) throw new Error("User not found");
  return user.points || 0;
}

async function addPoints(userId, amount, reason, sessionId = null) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    const current = user.points || 0;
    const next = current + amount;

    user.points = next;
    await user.save();

    await PointTransaction.create(
      [
        {
          userId,
          amount,
          reason,
          sessionId,
          balanceAfter: next,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return next;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function deductPoints(userId, amount, reason, sessionId = null) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    const current = user.points || 0;
    if (current < amount) {
      throw new Error("Not enough points");
    }

    const next = current - amount;
    user.points = next;
    await user.save();

    await PointTransaction.create(
      [
        {
          userId,
          amount: -amount,
          reason,
          sessionId,
          balanceAfter: next,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return next;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = {
  getBalance,
  addPoints,
  deductPoints,
};
