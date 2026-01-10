// server/services/pointsService.js
const mongoose = require("mongoose");
const User = require("../models/User");
const PointTransaction = require("../models/PointTransaction");

async function getBalance(userId) {
  const user = await User.findById(userId).select("points");
  if (!user) throw new Error("User not found");
  return user.points || 0;
}

async function findExistingTx({ userId, reason, sessionId, mongoSession }) {
  // Idempotency only makes sense when reason+sessionId are provided
  if (!sessionId || !reason) return null;

  return PointTransaction.findOne({
    userId,
    reason,
    sessionId,
  })
    .select("balanceAfter")
    .session(mongoSession || null);
}

async function addPoints(userId, amount, reason, sessionId = null, opts = {}) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const mongoSession = opts.mongoSession || (await mongoose.startSession());
  const ownsSession = !opts.mongoSession;

  if (ownsSession) mongoSession.startTransaction();

  try {
    // ✅ Idempotency: if already applied, return stored balanceAfter
    const existing = await findExistingTx({
      userId,
      reason,
      sessionId,
      mongoSession,
    });
    if (existing) {
      if (ownsSession) {
        await mongoSession.commitTransaction();
        mongoSession.endSession();
      }
      return existing.balanceAfter;
    }

    const user = await User.findById(userId).session(mongoSession);
    if (!user) throw new Error("User not found");

    const current = user.points || 0;
    const next = current + amount;

    user.points = next;
    await user.save({ session: mongoSession });

    await PointTransaction.create(
      [
        {
          userId,
          amount: +amount,
          reason,
          sessionId: sessionId || null,
          balanceAfter: next,
        },
      ],
      { session: mongoSession }
    );

    if (ownsSession) {
      await mongoSession.commitTransaction();
      mongoSession.endSession();
    }

    return next;
  } catch (err) {
    if (ownsSession) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
    }
    throw err;
  }
}

async function deductPoints(
  userId,
  amount,
  reason,
  sessionId = null,
  opts = {}
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const mongoSession = opts.mongoSession || (await mongoose.startSession());
  const ownsSession = !opts.mongoSession;

  if (ownsSession) mongoSession.startTransaction();

  try {
    // ✅ Idempotency: if already applied, return stored balanceAfter
    const existing = await findExistingTx({
      userId,
      reason,
      sessionId,
      mongoSession,
    });
    if (existing) {
      if (ownsSession) {
        await mongoSession.commitTransaction();
        mongoSession.endSession();
      }
      return existing.balanceAfter;
    }

    const user = await User.findById(userId).session(mongoSession);
    if (!user) throw new Error("User not found");

    const current = user.points || 0;
    if (current < amount) {
      throw new Error("Not enough points");
    }

    const next = current - amount;

    user.points = next;
    await user.save({ session: mongoSession });

    await PointTransaction.create(
      [
        {
          userId,
          amount: -amount,
          reason,
          sessionId: sessionId || null,
          balanceAfter: next,
        },
      ],
      { session: mongoSession }
    );

    if (ownsSession) {
      await mongoSession.commitTransaction();
      mongoSession.endSession();
    }

    return next;
  } catch (err) {
    if (ownsSession) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
    }
    throw err;
  }
}

module.exports = {
  getBalance,
  addPoints,
  deductPoints,
};
