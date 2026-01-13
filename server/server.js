// server/server.js
require("dotenv").config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const User = require("./models/User");
const Conversation = require("./models/Conversation");
const Message = require("./models/Message");

const pointsRoutes = require("./routes/points.routes");
const sessionsRouter = require("./routes/sessions");
const usersRouter = require("./routes/users");
const chatRouter = require("./routes/chat");
const ratingsRouter = require("./routes/ratings");

const { findMentorMatches } = require("./services/matchingService");

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret-123";
const PORT = process.env.PORT || 4000;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env – cannot start server");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err?.message || err);
    process.exit(1);
  });

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/", (req, res) => res.send("SkillBridge API is running ✅"));

app.get("/api/matching/status", (req, res) => {
  const mode = process.env.MATCHING_MODE || "local";
  res.json({
    ok: true,
    mode,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    embedModel: process.env.OPENAI_EMBED_MODEL || null,
  });
});

// =======================
// AUTH
// =======================
app.post("/auth/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const exists = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });
    if (exists) return res.status(409).json({ error: "Email already in use" });

    const hashed = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      fullName: String(fullName).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash: hashed,

      // ✅ DEV ONLY – plain password (NOT used for auth)
      passwordPlain: String(password),

      points: 0,
      xp: 0,
      streak: 0,

      avgRating: 0,
      ratingCount: 0,

      skillsToLearn: [],
      skillsToTeach: [],
      availabilitySlots: [],
      preferences: { communicationModes: [], languages: [] },
    });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        points: user.points,
        xp: user.xp,
        streak: user.streak,
        avgRating: user.avgRating,
        ratingCount: user.ratingCount,
      },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        points: user.points,
        xp: user.xp,
        streak: user.streak,
        avgRating: user.avgRating,
        ratingCount: user.ratingCount,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

// =======================
// ME
// =======================
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

app.put("/api/me/profile", authMiddleware, async (req, res) => {
  try {
    const updates = req.body || {};
    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
    }).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// =======================
// MATCHING
// =======================
app.post("/api/matches/mentors", authMiddleware, async (req, res) => {
  try {
    const modeFromQuery = String((req.query || {}).mode || "").trim();
    const modeFromBody = String((req.body || {}).mode || "").trim();
    const mode = modeFromQuery || modeFromBody || "";

    const payload = req.body || {};
    const skillQuery = String(payload.skillQuery || payload.skill || "").trim();

    const userAvailability = Array.isArray(payload.userAvailability)
      ? payload.userAvailability
      : Array.isArray(payload.availabilitySlots)
      ? payload.availabilitySlots
      : [];

    const level = payload.level || "Beginner";

    const params = {
      userId: String(req.userId),
      mode,
      level,
      skillQuery,
      userAvailability,
    };

    const out = await findMentorMatches(params);

    return res.json({
      results: Array.isArray(out?.results) ? out.results : [],
      meta: out?.meta || null,
    });
  } catch (err) {
    console.error("MATCHING ERROR:", err);
    return res.status(500).json({ error: "Failed to find mentor matches" });
  }
});

// =======================
// ROUTES
// =======================
app.use("/api/points", authMiddleware, pointsRoutes);
app.use("/api/sessions", sessionsRouter(authMiddleware));
app.use("/api/users", usersRouter(authMiddleware));
app.use("/api/chat", chatRouter(authMiddleware));
app.use("/api/ratings", ratingsRouter(authMiddleware));

// =======================
// SOCKET.IO
// =======================
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ===== Presence tracking =====
const userSocketsCount = new Map(); // userId -> count
const lastSeenMap = new Map(); // userId -> Date ISO

function incOnline(userId) {
  const prev = userSocketsCount.get(userId) || 0;
  const next = prev + 1;
  userSocketsCount.set(userId, next);
  return { prev, next, firstOnline: prev === 0 };
}

function decOnline(userId) {
  const prev = userSocketsCount.get(userId) || 0;
  const next = Math.max(0, prev - 1);

  if (next === 0) {
    userSocketsCount.delete(userId);
    lastSeenMap.set(userId, new Date().toISOString());
    return { prev, next, wentOffline: prev > 0 };
  }

  userSocketsCount.set(userId, next);
  return { prev, next, wentOffline: false };
}

function isOnline(userId) {
  return (userSocketsCount.get(userId) || 0) > 0;
}

function presencePayload(userId) {
  const uid = String(userId);
  return {
    userId: uid,
    online: isOnline(uid),
    lastSeen: lastSeenMap.get(uid) || null,
  };
}

// watchers room per user
function presenceWatchRoom(userId) {
  return `presence:watch:${String(userId)}`;
}

async function emitPresenceToConversationsOfUser(userId) {
  const uid = String(userId);
  try {
    const convs = await Conversation.find({ participants: uid })
      .select("_id")
      .lean();

    for (const c of convs) {
      await emitPresenceToConversation(String(c._id), uid);
    }
  } catch {
    // ignore
  }
}

async function emitPresenceToConversation(convId, userId) {
  try {
    const conv = await Conversation.findById(convId)
      .select("participants")
      .lean();
    if (!conv) return;

    const participants = (conv.participants || []).map(String);
    const payload = presencePayload(userId);

    for (const pid of participants) {
      io.to(`user:${pid}`).emit("presence:update", payload);
    }
  } catch {
    // ignore
  }
}

function emitPresenceToWatchers(userId) {
  const uid = String(userId);
  io.to(presenceWatchRoom(uid)).emit("presence:update", presencePayload(uid));
}

// ===== JWT auth for sockets =====
io.use((socket, next) => {
  try {
    const tokenFromAuth = socket.handshake.auth?.token;
    const tokenFromHeader = String(
      socket.handshake.headers?.authorization || ""
    )
      .replace("Bearer ", "")
      .trim();

    const token = String(tokenFromAuth || tokenFromHeader || "").trim();
    if (!token) return next(new Error("Missing token"));

    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = String(payload.userId);
    return next();
  } catch {
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const me = String(socket.userId);

  // personal room for direct events (presence, etc.)
  socket.join(`user:${me}`);

  // mark online + self presence
  const { firstOnline } = incOnline(me);

  // self update (always)
  io.to(`user:${me}`).emit("presence:update", {
    userId: me,
    online: true,
    lastSeen: lastSeenMap.get(me) || null,
  });

  // ✅ IMPORTANT: when user becomes online (first socket), notify all peers immediately
  if (firstOnline) {
    void emitPresenceToConversationsOfUser(me);
    emitPresenceToWatchers(me);
  }

  // ✅ Presence snapshot (ack)
  socket.on("presence:get", ({ userId }, cb) => {
    try {
      const uid = String(userId || "").trim();
      if (!uid) return cb?.(null);
      return cb?.(presencePayload(uid));
    } catch {
      return cb?.(null);
    }
  });

  // ✅ Watch/unwatch presence (real feature now)
  socket.on("presence:watch", ({ userId }) => {
    const uid = String(userId || "").trim();
    if (!uid) return;
    socket.join(presenceWatchRoom(uid));
    // optional immediate push for smoother UX
    socket.emit("presence:update", presencePayload(uid));
  });

  socket.on("presence:unwatch", ({ userId }) => {
    const uid = String(userId || "").trim();
    if (!uid) return;
    socket.leave(presenceWatchRoom(uid));
  });

  socket.on("conversation:join", async ({ conversationId, peerId }) => {
    try {
      const convId = String(conversationId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(convId)) return;

      const conv = await Conversation.findById(convId)
        .select("participants")
        .lean();
      if (!conv) return;

      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return;

      socket.join(convId);

      // optional: peer presence immediately
      const peer = String(peerId || "").trim();
      if (peer) {
        socket.emit("presence:update", presencePayload(peer));
      }

      // ✅ NO read marking here. Join should NOT imply "seen".
    } catch {
      // ignore
    }
  });

  socket.on("conversation:read", async ({ conversationId }) => {
    try {
      const convId = String(conversationId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(convId)) return;

      const conv = await Conversation.findById(convId)
        .select("participants")
        .lean();
      if (!conv) return;

      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return;

      const res = await Message.updateMany(
        {
          conversationId: convId,
          senderId: { $ne: me },
          readBy: { $ne: me },
        },
        { $addToSet: { readBy: me } }
      );

      // ✅ only emit receipt if something actually changed
      const changed =
        (typeof res?.modifiedCount === "number" && res.modifiedCount > 0) ||
        (typeof res?.nModified === "number" && res.nModified > 0);

      if (changed) {
        socket.to(convId).emit("read:receipt", {
          conversationId: convId,
          readerId: me,
          readAt: new Date().toISOString(),
        });
      }
    } catch {
      // ignore
    }
  });

  socket.on("typing", async ({ conversationId, isTyping }) => {
    try {
      const convId = String(conversationId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(convId)) return;

      const conv = await Conversation.findById(convId)
        .select("participants")
        .lean();
      if (!conv) return;

      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return;

      socket.to(convId).emit("typing", {
        conversationId: convId,
        userId: me,
        isTyping: !!isTyping,
      });
    } catch {
      // ignore
    }
  });

  socket.on("message:send", async ({ conversationId, text }, cb) => {
    try {
      const convId = String(conversationId || "").trim();
      const clean = String(text || "").trim();

      if (!clean) return cb?.({ ok: false, error: "Text is required" });
      if (!mongoose.Types.ObjectId.isValid(convId))
        return cb?.({ ok: false, error: "Invalid conversation id" });

      const conv = await Conversation.findById(convId);
      if (!conv) return cb?.({ ok: false, error: "Conversation not found" });

      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return cb?.({ ok: false, error: "Not allowed" });

      const msg = await Message.create({
        conversationId: convId,
        senderId: me,
        text: clean,
        readBy: [me],
      });

      conv.lastMessageText = clean.slice(0, 200);
      conv.lastMessageAt = msg.createdAt;
      await conv.save();

      const payload = {
        id: String(msg._id),
        conversationId: convId,
        senderId: me,
        text: msg.text,
        createdAt: msg.createdAt,
      };

      io.to(convId).emit("message:new", payload);
      return cb?.({ ok: true, message: payload });
    } catch {
      return cb?.({ ok: false, error: "Failed to send" });
    }
  });

  socket.on("disconnect", async () => {
    const { wentOffline } = decOnline(me);

    io.to(`user:${me}`).emit("presence:update", presencePayload(me));

    if (wentOffline) {
      // ✅ notify all my conversations participants immediately
      await emitPresenceToConversationsOfUser(me);
      emitPresenceToWatchers(me);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
