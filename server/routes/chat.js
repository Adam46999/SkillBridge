// server/routes/chat.js
const express = require("express");
const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || "").trim());
}

module.exports = (authMiddleware) => {
  const router = express.Router();

  // protect all chat routes
  router.use(authMiddleware);

  /**
   * GET /api/chat/inbox
   * returns: { items: ChatInboxItem[] }
   */
  router.get("/inbox", async (req, res) => {
    try {
      const me = String(req.userId || "").trim();
      if (!isValidId(me))
        return res.status(401).json({ error: "Invalid token" });

      const convs = await Conversation.find({ participants: me })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean();

      if (!convs.length) return res.json({ items: [] });

      // collect peers ids
      const peerIds = [];
      for (const c of convs) {
        const parts = (c.participants || []).map(String);
        const peer = parts.find((p) => p !== me);
        if (peer && isValidId(peer)) peerIds.push(peer);
      }

      // fetch peers public data
      const peers = await User.find({ _id: { $in: peerIds } })
        .select("fullName points xp streak avgRating ratingCount")
        .lean();

      const peerMap = new Map(
        peers.map((p) => [
          String(p._id),
          {
            id: String(p._id),
            fullName: p.fullName || "Unknown",
            points: Number(p.points || 0),
            xp: Number(p.xp || 0),
            streak: Number(p.streak || 0),
            avgRating: Number(p.avgRating || 0),
            ratingCount: Number(p.ratingCount || 0),
          },
        ])
      );

      // unread count per conversation (messages not from me and me not in readBy)
      const unreadAgg = await Message.aggregate([
        {
          $match: {
            conversationId: { $in: convs.map((c) => c._id) },
            senderId: { $ne: new mongoose.Types.ObjectId(me) },
            // ✅ FIX: array-safe "not in readBy"
            readBy: { $nin: [new mongoose.Types.ObjectId(me)] },
          },
        },
        { $group: { _id: "$conversationId", count: { $sum: 1 } } },
      ]);

      const unreadMap = new Map(
        unreadAgg.map((x) => [String(x._id), Number(x.count || 0)])
      );

      const items = convs.map((c) => {
        const parts = (c.participants || []).map(String);
        const peerId = parts.find((p) => p !== me) || "";
        const peer = peerMap.get(String(peerId)) || null;

        return {
          id: String(c._id), // conversationId
          peer,
          lastMessageText: String(c.lastMessageText || ""),
          lastMessageAt: c.lastMessageAt
            ? new Date(c.lastMessageAt).toISOString()
            : null,
          updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
          unreadCount: unreadMap.get(String(c._id)) || 0,
        };
      });

      return res.json({ items });
    } catch (err) {
      console.error("CHAT INBOX ERROR:", err?.message || err);
      return res.status(500).json({ error: "Failed to load inbox" });
    }
  });

  /**
   * POST /api/chat/conversation
   * body: { peerId }
   * returns: { conversationId }
   */
  router.post("/conversation", async (req, res) => {
    try {
      const me = String(req.userId || "").trim();
      const peerId = String(req.body?.peerId || "").trim();

      if (!isValidId(me))
        return res.status(401).json({ error: "Invalid token" });
      if (!isValidId(peerId))
        return res.status(400).json({ error: "Invalid peerId" });
      if (me === peerId)
        return res.status(400).json({ error: "Invalid peerId" });

      // try find existing (1-to-1)
      let conv = await Conversation.findOne({
        participants: { $all: [me, peerId], $size: 2 },
      });

      if (!conv) {
        conv = await Conversation.create({
          participants: [me, peerId],
          lastMessageText: "",
          lastMessageAt: null,
        });
      }

      return res.json({ conversationId: String(conv._id) });
    } catch (err) {
      console.error("CHAT CONVERSATION ERROR:", err?.message || err);
      return res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  /**
   * GET /api/chat/:conversationId/messages?limit=50&before=ISO
   * returns: { items: ChatMessage[] }
   */
  router.get("/:conversationId/messages", async (req, res) => {
    try {
      const me = String(req.userId || "").trim();
      const conversationId = String(req.params.conversationId || "").trim();
      if (!isValidId(me))
        return res.status(401).json({ error: "Invalid token" });
      if (!isValidId(conversationId))
        return res.status(400).json({ error: "Invalid conversationId" });

      const conv = await Conversation.findById(conversationId)
        .select("participants")
        .lean();
      if (!conv)
        return res.status(404).json({ error: "Conversation not found" });

      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return res.status(403).json({ error: "Not allowed" });

      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
      const before = String(req.query.before || "").trim();

      const find = {
        conversationId: new mongoose.Types.ObjectId(conversationId),
      };

      if (before) {
        const d = new Date(before);
        if (!Number.isNaN(d.getTime())) {
          find.createdAt = { $lt: d };
        }
      }

      const msgs = await Message.find(find)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // return oldest -> newest
      const items = msgs
        .slice()
        .reverse()
        .map((m) => ({
          id: String(m._id),
          conversationId: String(m.conversationId),
          senderId: String(m.senderId),
          text: String(m.text || ""),
          createdAt: m.createdAt
            ? new Date(m.createdAt).toISOString()
            : new Date().toISOString(),
        }));

      return res.json({ items });
    } catch (err) {
      console.error("CHAT MESSAGES ERROR:", err?.message || err);
      return res.status(500).json({ error: "Failed to load messages" });
    }
  });

  /**
   * ✅ POST /api/chat/:conversationId/read
   * marks all messages (sent by other users) as read by me
   * returns: { ok: true, modified: number }
   */
  router.post("/:conversationId/read", async (req, res) => {
    try {
      const me = String(req.userId || "").trim();
      const conversationId = String(req.params.conversationId || "").trim();

      if (!isValidId(me))
        return res.status(401).json({ error: "Invalid token" });
      if (!isValidId(conversationId))
        return res.status(400).json({ error: "Invalid conversationId" });

      const conv = await Conversation.findById(conversationId)
        .select("participants")
        .lean();
      if (!conv)
        return res.status(404).json({ error: "Conversation not found" });

      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return res.status(403).json({ error: "Not allowed" });

      const meObj = new mongoose.Types.ObjectId(me);

      const result = await Message.updateMany(
        {
          conversationId: new mongoose.Types.ObjectId(conversationId),
          senderId: { $ne: meObj },
          readBy: { $nin: [meObj] },
        },
        { $addToSet: { readBy: meObj } }
      );

      const modified =
        Number(result?.modifiedCount ?? result?.nModified ?? 0) || 0;

      return res.json({ ok: true, modified });
    } catch (err) {
      console.error("CHAT READ ERROR:", err?.message || err);
      return res.status(500).json({ error: "Failed to mark as read" });
    }
  });

  /**
   * POST /api/chat/:conversationId/messages
   * body: { text }
   * returns: { message }
   */
  router.post("/:conversationId/messages", async (req, res) => {
    try {
      const me = String(req.userId || "").trim();
      const conversationId = String(req.params.conversationId || "").trim();
      const text = String(req.body?.text || "").trim();

      if (!isValidId(me))
        return res.status(401).json({ error: "Invalid token" });
      if (!isValidId(conversationId))
        return res.status(400).json({ error: "Invalid conversationId" });
      if (!text) return res.status(400).json({ error: "Text is required" });

      const conv = await Conversation.findById(conversationId);
      if (!conv)
        return res.status(404).json({ error: "Conversation not found" });

      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return res.status(403).json({ error: "Not allowed" });

      const msg = await Message.create({
        conversationId,
        senderId: me,
        text,
        readBy: [me],
      });

      conv.lastMessageText = text.slice(0, 200);
      conv.lastMessageAt = msg.createdAt;
      await conv.save();

      return res.json({
        message: {
          id: String(msg._id),
          conversationId: String(msg.conversationId),
          senderId: String(msg.senderId),
          text: String(msg.text || ""),
          createdAt: msg.createdAt
            ? new Date(msg.createdAt).toISOString()
            : new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("CHAT SEND ERROR:", err?.message || err);
      return res.status(500).json({ error: "Failed to send message" });
    }
  });

  return router;
};
