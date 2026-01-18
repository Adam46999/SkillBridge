// server/services/ratingsService.js
const mongoose = require("mongoose");
const Rating = require("../models/Rating");
const Session = require("../models/Session");
const User = require("../models/User");

const rules = require("./gamificationRules");
const { addPoints } = require("./pointsService");

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function clampLimit(n, def = 20, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return def;
  return Math.min(max, Math.max(1, Math.floor(x)));
}

async function recomputeAndSaveAvg(toUserId, mongoSession) {
  // compute avg + count from Rating collection (source of truth)
  const agg = await Rating.aggregate([
    { $match: { toUserId: new mongoose.Types.ObjectId(String(toUserId)) } },
    {
      $group: {
        _id: "$toUserId",
        avg: { $avg: "$score" },
        count: { $sum: 1 },
      },
    },
  ]).session(mongoSession);

  const avg = Number(agg?.[0]?.avg || 0);
  const count = Number(agg?.[0]?.count || 0);

  const updatedUser = await User.findByIdAndUpdate(
    toUserId,
    { avgRating: avg, ratingCount: count },
    { new: true, session: mongoSession }
  )
    .select("fullName avgRating ratingCount points xp streak")
    .lean();

  return updatedUser;
}

/**
 * createSessionRating:
 * - validates session + permissions
 * - creates Rating (unique per session)
 * - updates User avgRating + ratingCount
 * - gives high-rating bonus points (idempotent via pointsService)
 * - best-effort: sets Session.rating/feedback if empty (compat with old endpoint)
 */
async function createSessionRating({ fromUserId, sessionId, score, comment }) {
  const fromId = String(fromUserId || "").trim();
  const sessId = String(sessionId || "").trim();
  const s = Number(score);
  const c = String(comment || "").trim();

  if (!isValidObjectId(fromId)) throw httpError(401, "Invalid user");
  if (!isValidObjectId(sessId)) throw httpError(400, "Invalid sessionId");

  const min = rules?.RATING?.MIN ?? 1;
  const max = rules?.RATING?.MAX ?? 5;

  if (!Number.isFinite(s) || s < min || s > max) {
    throw httpError(400, `score must be between ${min} and ${max}`);
  }

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const sessionDoc = await Session.findById(sessId).session(mongoSession);
    if (!sessionDoc) throw httpError(404, "Session not found");

    if (String(sessionDoc.status) !== "completed") {
      throw httpError(400, "You can rate only completed sessions");
    }

    const mentorId = String(sessionDoc.mentorId);
    const learnerId = String(sessionDoc.learnerId);

    const isMentor = mentorId === fromId;
    const isLearner = learnerId === fromId;

    if (!isMentor && !isLearner) {
      throw httpError(403, "Not allowed");
    }

    const toUserId = isMentor ? learnerId : mentorId;
    if (!toUserId || !isValidObjectId(toUserId)) {
      throw httpError(500, "Invalid session participants");
    }

    // Create rating (unique per session)
    let rating;
    try {
      rating = await Rating.create(
        [
          {
            sessionId: sessId,
            fromUserId: fromId,
            toUserId,
            score: Math.round(s),
            comment: c || undefined,
          },
        ],
        { session: mongoSession }
      );
      rating = rating?.[0];
    } catch (err) {
      // Duplicate key => rating already exists for this session
      if (String(err?.code) === "11000") {
        throw httpError(400, "Session already rated");
      }
      throw err;
    }

    // Best-effort: keep Session fields in sync (only if empty)
    if (sessionDoc.rating == null) sessionDoc.rating = rating.score;
    if (!String(sessionDoc.feedback || "").trim() && c) sessionDoc.feedback = c;
    await sessionDoc.save({ session: mongoSession });

    // Update avg rating & count
    const updatedUser = await recomputeAndSaveAvg(toUserId, mongoSession);

    // Award points directly based on rating score (10-50 points)
    // The rating score IS the points to award
    await addPoints(
      toUserId,
      rating.score, // Award the exact rating score as points
      rules.REASONS.HIGH_RATING_BONUS, // Reuse this reason for consistency
      sessId,
      { mongoSession }
    );

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    return { rating, updatedUser };
  } catch (err) {
    await mongoSession.abortTransaction();
    mongoSession.endSession();
    throw err;
  }
}

/**
 * listRatingsForUser:
 * - latest ratings received by user
 */
async function listRatingsForUser({ userId, limit }) {
  const id = String(userId || "").trim();
  if (!isValidObjectId(id)) throw httpError(400, "Invalid user id");

  const lim = clampLimit(limit, 20, 100);

  const items = await Rating.find({ toUserId: id })
    .sort({ createdAt: -1 })
    .limit(lim)
    .select("sessionId fromUserId toUserId score comment createdAt")
    .lean();

  return items.map((r) => ({
    id: String(r._id),
    sessionId: String(r.sessionId),
    fromUserId: String(r.fromUserId),
    toUserId: String(r.toUserId),
    score: Number(r.score),
    comment: String(r.comment || ""),
    createdAt: r.createdAt,
  }));
}

module.exports = {
  createSessionRating,
  listRatingsForUser,
};
