// server/routes/sessions.js
const express = require("express");
const mongoose = require("mongoose");
const Session = require("../models/Session");

const {
  getBalance,
  addPoints,
  deductPoints,
} = require("../services/pointsService");
const { POINTS, CANCEL, REASONS } = require("../services/gamificationRules");
const { rateSession } = require("../services/ratingsService");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function normalizeStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "canceled") return "cancelled";
  return s;
}

function toMs(v) {
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : null;
}

function isTimeReached(when) {
  const t = toMs(when);
  return !!t && t <= Date.now();
}

function minutesUntil(when) {
  const t = toMs(when);
  if (!t) return null;
  return Math.floor((t - Date.now()) / 60000);
}

function minutesSince(when) {
  const t = toMs(when);
  if (!t) return null;
  return Math.floor((Date.now() - t) / 60000);
}

function isLateCancel(scheduledAt) {
  const mins = minutesUntil(scheduledAt);
  if (mins === null) return false;
  return mins >= 0 && mins <= Number(CANCEL?.LATE_WINDOW_MINUTES ?? 120);
}

const RULES = {
  JOIN_EARLY_MIN: 30,
  JOIN_LATE_MIN: 180,
  COMPLETE_MAX_DELAY_MIN: 24 * 60,
  ACCEPT_REJECT_BLOCK_AT_START: true,
};

function canJoinNow(sessionDoc) {
  const until = minutesUntil(sessionDoc.scheduledAt);
  if (until === null) return { ok: false, reason: "Invalid scheduledAt" };
  if (until > 0 && until <= RULES.JOIN_EARLY_MIN) return { ok: true };
  if (until <= 0) {
    const since = minutesSince(sessionDoc.scheduledAt);
    if (since !== null && since <= RULES.JOIN_LATE_MIN) return { ok: true };
    return { ok: false, reason: "Join window expired" };
  }
  return { ok: false, reason: "Too early to join" };
}

function canCompleteNow(sessionDoc) {
  if (!isTimeReached(sessionDoc.scheduledAt))
    return { ok: false, reason: "Too early to complete" };
  const since = minutesSince(sessionDoc.scheduledAt);
  if (since === null) return { ok: false, reason: "Invalid scheduledAt" };
  if (since > RULES.COMPLETE_MAX_DELAY_MIN)
    return { ok: false, reason: "Completion window expired" };
  return { ok: true };
}

function pickUser(u) {
  if (!u) return null;

  // إذا u مجرد id (string أو ObjectId) -> رجّع DTO بسيط
  if (typeof u === "string" || u instanceof mongoose.Types.ObjectId) {
    return { id: String(u), fullName: "", email: "" };
  }

  // إذا u populated object
  return {
    id: String(u._id),
    fullName: u.fullName || "",
    email: u.email || "",
    points: u.points,
    xp: u.xp,
    streak: u.streak,
    avgRating: u.avgRating,
    ratingCount: u.ratingCount,
  };
}

function idOf(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v._id) return String(v._id);
  if (v.id) return String(v.id);
  return String(v);
}

function toDTO(doc) {
  const o = doc?.toObject ? doc.toObject() : doc;

  const mentorIdStr = idOf(o.mentorId);
  const learnerIdStr = idOf(o.learnerId);

  return {
    ...o,
    mentorId: mentorIdStr,
    learnerId: learnerIdStr,
    mentor: pickUser(o.mentorId),
    learner: pickUser(o.learnerId),
  };
}

// ---------------- FILE UPLOAD (NEW) ----------------
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = String(file.originalname || "file").replace(/[^\w.\-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage });

module.exports = function sessionsRouter(authMiddleware) {
  const router = express.Router();

  async function populateSession(id) {
    return Session.findById(id)
      .populate(
        "mentorId",
        "fullName email points xp streak avgRating ratingCount"
      )
      .populate(
        "learnerId",
        "fullName email points xp streak avgRating ratingCount"
      );
  }

  async function updateStatusInternal(req, res, statusRaw) {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      const nextStatus = normalizeStatus(statusRaw);

      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);
      const isMentor = mentorId === userId;
      const isLearner = learnerId === userId;
      if (!isMentor && !isLearner)
        return res.status(403).json({ error: "Not allowed" });

      // ✅ auto-cancel expired requested
      if (s.status === "requested" && isTimeReached(s.scheduledAt)) {
        s.status = "cancelled";
        s.cancelledAt = s.cancelledAt || new Date();
        s.cancelReason = s.cancelReason || "expired_request";
        s.cancelledBy = s.cancelledBy || userId;
        await s.save();
        return res.status(400).json({
          error: "Request expired and was cancelled automatically",
          session: toDTO(await populateSession(s._id)),
        });
      }

      // ✅ auto-cancel too old accepted
      if (s.status === "accepted") {
        const since = minutesSince(s.scheduledAt);
        if (since !== null && since > RULES.COMPLETE_MAX_DELAY_MIN) {
          s.status = "cancelled";
          s.cancelledAt = s.cancelledAt || new Date();
          s.cancelReason = s.cancelReason || "missed";
          s.cancelledBy = s.cancelledBy || userId;
          await s.save();
          return res.status(400).json({
            error: "Session too old and was cancelled automatically",
            session: toDTO(await populateSession(s._id)),
          });
        }
      }

      const current = normalizeStatus(s.status);

      // transition guard (minimal)
      const ok =
        (current === "requested" &&
          (nextStatus === "accepted" ||
            nextStatus === "rejected" ||
            nextStatus === "cancelled")) ||
        (current === "accepted" &&
          (nextStatus === "cancelled" || nextStatus === "completed")) ||
        (current !== "completed" && nextStatus === "cancelled");

      if (!ok)
        return res
          .status(400)
          .json({ error: `Invalid transition: ${current} -> ${nextStatus}` });

      if ((nextStatus === "accepted" || nextStatus === "rejected") && !isMentor)
        return res.status(403).json({ error: "Mentor only" });

      if (
        (nextStatus === "accepted" || nextStatus === "rejected") &&
        RULES.ACCEPT_REJECT_BLOCK_AT_START &&
        isTimeReached(s.scheduledAt)
      )
        return res
          .status(400)
          .json({ error: "You cannot accept/reject after time is reached" });

      if (current === "requested" && nextStatus === "accepted") {
        const cost = Number(POINTS?.BOOK_LEARN_SESSION_COST ?? 10);
        const bal = await getBalance(learnerId);
        if (bal < cost)
          return res
            .status(400)
            .json({ error: "Not enough points", needed: cost, balance: bal });
      }

      const wasLate = nextStatus === "cancelled" && isLateCancel(s.scheduledAt);

      // complete checks
      if (nextStatus === "completed") {
        // ---------------- CHANGE HERE (NEW UX) ----------------
        // بدك زر End Meeting يكمّل الجلسة حتى لو مش mentor
        // (إذا بدك mentor only ارجع حط شرط isMentor مثل ما كان)

        const chk = canCompleteNow(s);
        if (!chk.ok) return res.status(400).json({ error: chk.reason });

        const joinedBy = Array.isArray(s.joinedBy)
          ? s.joinedBy.map(String)
          : [];
        const mentorHasJoined = joinedBy.includes(mentorId);
        const learnerHasJoined = joinedBy.includes(learnerId);

        if (!mentorHasJoined && !learnerHasJoined)
          return res.status(400).json({
            error: "At least one side must join before completing",
          });

        s.completedAt = new Date();
      }

      if (nextStatus === "cancelled") {
        s.cancelledAt = new Date();
        s.cancelledBy = userId;
        if (!s.cancelReason)
          s.cancelReason = wasLate ? "late_cancel" : "cancelled";
      }

      s.status = nextStatus;
      await s.save();

      // points side effects (kept)
      try {
        if (current === "requested" && nextStatus === "accepted") {
          const cost = Number(POINTS?.BOOK_LEARN_SESSION_COST ?? 10);
          await deductPoints(
            learnerId,
            cost,
            REASONS?.BOOK_SESSION || "book_session",
            { sessionId: String(s._id) }
          );
        }
        if (current === "accepted" && nextStatus === "completed") {
          const earn = Number(POINTS?.TEACH_SESSION_EARN ?? 10);
          await addPoints(
            mentorId,
            earn,
            REASONS?.TEACH_SESSION || "teach_session",
            { sessionId: String(s._id) }
          );
        }
        if (nextStatus === "cancelled" && wasLate) {
          const penalty = Number(POINTS?.LATE_CANCEL_PENALTY ?? 2);
          await deductPoints(
            userId,
            penalty,
            REASONS?.LATE_CANCEL || "late_cancel",
            { sessionId: String(s._id) }
          );
        }
      } catch (e) {
        console.error("POINTS SIDE-EFFECT ERROR:", e);
      }

      const populated = await populateSession(s._id);
      return res.json({ session: toDTO(populated) });
    } catch (err) {
      console.error("UPDATE STATUS ERROR:", err);
      return res.status(500).json({ error: "Failed to update session" });
    }
  }

  // create
  router.post("/", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const { mentorId, skill, level, scheduledAt, note } = req.body || {};
      if (!isValidObjectId(mentorId))
        return res.status(400).json({ error: "Invalid mentorId" });
      if (!skill) return res.status(400).json({ error: "Missing skill" });
      if (!scheduledAt)
        return res.status(400).json({ error: "Missing scheduledAt" });

      const when = new Date(String(scheduledAt));
      if (Number.isNaN(when.getTime()))
        return res.status(400).json({ error: "Invalid scheduledAt" });
      if (when.getTime() <= Date.now())
        return res
          .status(400)
          .json({ error: "Cannot request a session in the past" });

      const s = await Session.create({
        mentorId: String(mentorId),
        learnerId: userId,
        skill: String(skill),
        level: String(level || "Not specified"),
        scheduledAt: when,
        note: String(note || ""),
      });

      const populated = await populateSession(s._id);
      return res.json({ session: toDTO(populated) });
    } catch (err) {
      console.error("CREATE SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to create session" });
    }
  });

  // ---------------- IMPORTANT ORDER FIX ----------------
  // لازم /mine قبل /:id
  // list mine + auto-cancel expired
  router.get("/mine", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const now = new Date();

      await Session.updateMany(
        { status: "requested", scheduledAt: { $lte: now } },
        {
          $set: {
            status: "cancelled",
            cancelledAt: now,
            cancelReason: "expired_request",
          },
        }
      );

      const tooOld = new Date(
        Date.now() - RULES.COMPLETE_MAX_DELAY_MIN * 60 * 1000
      );
      await Session.updateMany(
        { status: "accepted", scheduledAt: { $lte: tooOld } },
        {
          $set: {
            status: "cancelled",
            cancelledAt: now,
            cancelReason: "missed",
          },
        }
      );

      const list = await Session.find({
        $and: [
          { $or: [{ mentorId: userId }, { learnerId: userId }] },
          {
            hiddenFor: {
              $nin: [new mongoose.Types.ObjectId(userId), String(userId)],
            },
          },
        ],
      })
        .sort({ scheduledAt: -1 })
        .populate(
          "mentorId",
          "fullName email points xp streak avgRating ratingCount"
        )
        .populate(
          "learnerId",
          "fullName email points xp streak avgRating ratingCount"
        );

      return res.json({ sessions: list.map(toDTO) });
    } catch (err) {
      console.error("LIST SESSIONS ERROR:", err);
      return res.status(500).json({ error: "Failed to list sessions" });
    }
  });

  // get by id (بعد /mine)
  router.get("/:id", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await populateSession(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId?._id || s.mentorId);
      const learnerId = String(s.learnerId?._id || s.learnerId);
      if (mentorId !== userId && learnerId !== userId)
        return res.status(403).json({ error: "Not allowed" });

      return res.json({ session: toDTO(s) });
    } catch (err) {
      console.error("GET SESSION ERROR:", err);
      return res.status(500).json({ error: "Failed to get session" });
    }
  });

  // status + shortcuts
  router.patch("/:id/status", authMiddleware, (req, res) =>
    updateStatusInternal(req, res, req.body?.status)
  );

  router.post("/:id/join", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);
      const isMentor = mentorId === userId;
      const isLearner = learnerId === userId;
      if (!isMentor && !isLearner)
        return res.status(403).json({ error: "Not allowed" });

      if (s.status === "requested" && isTimeReached(s.scheduledAt)) {
        s.status = "cancelled";
        s.cancelledAt = new Date();
        s.cancelReason = "expired_request";
        s.cancelledBy = userId;
        await s.save();
        return res
          .status(400)
          .json({ error: "Request expired and was cancelled automatically" });
      }

      if (normalizeStatus(s.status) !== "accepted")
        return res
          .status(400)
          .json({ error: "Only accepted sessions can be joined" });

      const chk = canJoinNow(s);
      if (!chk.ok) return res.status(400).json({ error: chk.reason });

      const joinedBy = Array.isArray(s.joinedBy) ? s.joinedBy.map(String) : [];
      if (!joinedBy.includes(userId))
        s.joinedBy = [...(s.joinedBy || []), userId];
      if (!s.joinedAt) s.joinedAt = new Date();
      await s.save();

      const populated = await populateSession(s._id);
      return res.json({ session: toDTO(populated) });
    } catch (err) {
      console.error("JOIN ERROR:", err);
      return res.status(500).json({ error: "Failed to join session" });
    }
  });

  // ---------------- Session Room: CHAT (NEW) ----------------
  router.get("/:id/chat", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);
      if (mentorId !== userId && learnerId !== userId)
        return res.status(403).json({ error: "Not allowed" });

      const messages = Array.isArray(s.chat) ? s.chat : [];
      return res.json({ messages });
    } catch (err) {
      console.error("GET CHAT ERROR:", err);
      return res.status(500).json({ error: "Failed to load chat" });
    }
  });

  router.post("/:id/chat", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      const text = String(req.body?.text || "").trim();
      if (!text) return res.status(400).json({ error: "Missing text" });

      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);
      if (mentorId !== userId && learnerId !== userId)
        return res.status(403).json({ error: "Not allowed" });

      const msg = {
        _id: new mongoose.Types.ObjectId().toString(),
        senderId: userId,
        text,
        createdAt: new Date().toISOString(),
      };

      s.chat = Array.isArray(s.chat) ? s.chat : [];
      s.chat.push(msg);

      await s.save();
      return res.json({ message: msg });
    } catch (err) {
      console.error("POST CHAT ERROR:", err);
      return res.status(500).json({ error: "Failed to send message" });
    }
  });

  // ---------------- Session Room: FILES (NEW) ----------------
  router.get("/:id/files", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);
      if (mentorId !== userId && learnerId !== userId)
        return res.status(403).json({ error: "Not allowed" });

      const files = Array.isArray(s.files) ? s.files : [];
      return res.json({ files: files.slice().reverse() });
    } catch (err) {
      console.error("LIST FILES ERROR:", err);
      return res.status(500).json({ error: "Failed to list files" });
    }
  });

  router.post(
    "/:id/files",
    authMiddleware,
    upload.single("file"),
    async (req, res) => {
      try {
        const userId = String(req.userId);
        const id = String(req.params.id);

        if (!isValidObjectId(id))
          return res.status(400).json({ error: "Invalid session id" });

        const s = await Session.findById(id);
        if (!s) return res.status(404).json({ error: "Session not found" });

        const mentorId = String(s.mentorId);
        const learnerId = String(s.learnerId);
        if (mentorId !== userId && learnerId !== userId)
          return res.status(403).json({ error: "Not allowed" });

        if (!req.file) return res.status(400).json({ error: "Missing file" });

        // لازم السيرفر يكون بيسيرف /uploads ستاتيك
        const url = `/uploads/${req.file.filename}`;

        const f = {
          _id: new mongoose.Types.ObjectId().toString(),
          uploaderId: userId,
          name: req.file.originalname,
          url,
          createdAt: new Date().toISOString(),
        };

        s.files = Array.isArray(s.files) ? s.files : [];
        s.files.push(f);
        await s.save();

        return res.json({ file: f });
      } catch (err) {
        console.error("UPLOAD FILE ERROR:", err);
        return res.status(500).json({ error: "Failed to upload file" });
      }
    }
  );

  router.post("/:id/rate", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const rating = Number(req.body?.rating);
      const feedback = String(req.body?.feedback || "");

      const result = await rateSession({
        sessionId: id,
        userId,
        rating,
        feedback,
      });
      return res.json({ ok: true, rating: result?.rating || null });
    } catch (err) {
      const status = Number(err?.status || 500);
      console.error("RATE ERROR:", err);
      return res
        .status(status)
        .json({ error: err?.message || "Failed to rate session" });
    }
  });

  // ✅ SMART DELETE ENDPOINT
  router.post("/:id/delete", authMiddleware, async (req, res) => {
    try {
      const userId = String(req.userId);
      const id = String(req.params.id);
      if (!isValidObjectId(id))
        return res.status(400).json({ error: "Invalid session id" });

      const s = await Session.findById(id);
      if (!s) return res.status(404).json({ error: "Session not found" });

      const mentorId = String(s.mentorId);
      const learnerId = String(s.learnerId);
      const isMentor = mentorId === userId;
      const isLearner = learnerId === userId;
      if (!isMentor && !isLearner)
        return res.status(403).json({ error: "Not allowed" });

      // auto-cancel expired requested
      if (s.status === "requested" && isTimeReached(s.scheduledAt)) {
        s.status = "cancelled";
        s.cancelledAt = new Date();
        s.cancelReason = "expired_request";
        s.cancelledBy = userId;
      }

      const st = normalizeStatus(s.status);

      // helper: hide for current user
      const hideForMe = async () => {
        const me = new mongoose.Types.ObjectId(userId);
        const arr = Array.isArray(s.hiddenFor) ? s.hiddenFor.map(String) : [];
        if (!arr.includes(String(me))) {
          s.hiddenFor = [...(s.hiddenFor || []), me];
        }
      };

      // 1) requested
      if (st === "requested") {
        if (isLearner) {
          // I requested it -> treat delete as cancel for both + hide for me
          s.status = "cancelled";
          s.cancelledAt = new Date();
          s.cancelReason = "deleted_by_requester";
          s.cancelledBy = userId;
          s.deleteNotice = "The requester deleted the request.";
          await hideForMe();
          await s.save();
          return res.json({ ok: true, action: "cancelled_hidden" });
        } else if (isMentor) {
          // request received -> treat delete as reject + hide for me
          s.status = "rejected";
          s.deleteNotice = "The mentor deleted the request (rejected).";
          await hideForMe();
          await s.save();
          return res.json({ ok: true, action: "rejected_hidden" });
        }
      }

      // 2) accepted
      if (st === "accepted") {
        // delete => cancel for both, hide for me, other sees cancelled + notice
        const wasLate = isLateCancel(s.scheduledAt);
        s.status = "cancelled";
        s.cancelledAt = new Date();
        s.cancelReason = wasLate ? "late_cancel" : "deleted_after_accept";
        s.cancelledBy = userId;
        s.deleteNotice =
          "The other user deleted this session after acceptance.";
        await hideForMe();
        await s.save();

        // apply late-cancel penalty (book rules)
        try {
          if (wasLate) {
            const penalty = Number(POINTS?.LATE_CANCEL_PENALTY ?? 2);
            await deductPoints(
              userId,
              penalty,
              REASONS?.LATE_CANCEL || "late_cancel",
              { sessionId: String(s._id) }
            );
          }
        } catch (e) {
          console.error("DELETE->LATE PENALTY ERROR:", e);
        }

        return res.json({
          ok: true,
          action: "cancelled_hidden_other_notified",
        });
      }

      // 3) completed / cancelled / rejected => just hide for me
      if (st === "completed" || st === "cancelled" || st === "rejected") {
        await hideForMe();
        await s.save();
        return res.json({ ok: true, action: "hidden" });
      }

      return res
        .status(400)
        .json({ error: "Cannot delete this session in its current state" });
    } catch (err) {
      console.error("SMART DELETE ERROR:", err);
      return res.status(500).json({ error: "Failed to delete session" });
    }
  });

  return router;
};
