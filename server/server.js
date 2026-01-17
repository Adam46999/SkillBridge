// server/server.js
require("dotenv").config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const path = require("path");

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
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ephemeral in-memory map to block forwarding ICE candidates for pairs that rejected
// key format: `${from}->${to}`
const blockedIcePairs = new Set();

// short-lived map to track recent call-starts to avoid processing immediate rejects
// key format: `${from}->${to}` -> timestamp (ms)
const recentCallStarts = new Map();
// map to record recent call start metadata per conversation+user
// key: `${conversationId}:${userId}` -> { startTs: number, socketId: string }
const recentCallEvents = new Map();

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

// make io available to express routes if they need to emit
app.set("io", io);

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

  // ----- WebRTC signaling (simple relay) -----
  // Events: webrtc:offer, webrtc:answer, webrtc:ice-candidate
  socket.on("webrtc:offer", ({ toUserId, sdp }) => {
    try {
      const to = String(toUserId || "").trim();
      console.log(`[webrtc] offer received from ${me} -> ${to}`);
      if (!to || !sdp) {
        console.log("[webrtc] offer missing to or sdp");
        return;
      }
      // forward
      io.to(`user:${to}`).emit("webrtc:offer", { fromUserId: me, sdp });
      console.log(`[webrtc] offer forwarded to user:${to}`);
    } catch (err) {
      console.error("[webrtc] offer handler error:", err);
    }
  });

  socket.on("webrtc:answer", ({ toUserId, sdp }) => {
    try {
      const to = String(toUserId || "").trim();
      console.log(`[webrtc] answer received from ${me} -> ${to}`);
      if (!to || !sdp) {
        console.log("[webrtc] answer missing to or sdp");
        return;
      }
      // clear any reject block for this pair (answered -> allow candidates)
      try {
        const key = `${me}->${to}`;
        blockedIcePairs.delete(key);
      } catch {}
      io.to(`user:${to}`).emit("webrtc:answer", { fromUserId: me, sdp });
      console.log(`[webrtc] answer forwarded to user:${to}`);
    } catch (err) {
      console.error("[webrtc] answer handler error:", err);
    }
  });

  socket.on("webrtc:ice-candidate", ({ toUserId, candidate }) => {
    try {
      const to = String(toUserId || "").trim();
      console.log(`[webrtc] ice-candidate received from ${me} -> ${to}`);
      if (!to || !candidate) {
        console.log("[webrtc] ice-candidate missing to or candidate");
        return;
      }
      // do not forward ICE candidates if this pair recently rejected the call
      const key = `${me}->${to}`;
      if (blockedIcePairs.has(key)) {
        console.log(`[webrtc] ice-candidate dropped for blocked pair ${key}`);
        return;
      }

      io.to(`user:${to}`).emit("webrtc:ice-candidate", {
        fromUserId: me,
        candidate,
      });
      console.log(`[webrtc] ice-candidate forwarded to user:${to}`);
    } catch (err) {
      console.error("[webrtc] ice-candidate handler error:", err);
    }
  });

  // ----- optional ringing / reject relay -----
  socket.on("webrtc:ring", ({ toUserId, conversationId }) => {
    try {
      const to = String(toUserId || "").trim();
      console.log(`[webrtc] ring from ${me} -> ${to}`);
      if (!to) return;
      // forward ring and include conversationId if present
      const convoId = String(conversationId || "").trim();
      // include the target user id so clients can verify the recipient
      const payload = convoId
        ? { fromUserId: me, toUserId: to, conversationId: convoId }
        : { fromUserId: me, toUserId: to };
      io.to(`user:${to}`).emit("webrtc:ring", payload);
      console.log(`[webrtc] ring forwarded to user:${to}`, payload);
    } catch (err) {
      console.error("[webrtc] ring handler error:", err);
    }
  });

  // ----- call lifecycle logging (create chat message entries) -----
  socket.on("webrtc:call-start", async ({ conversationId, toUserId }) => {
    try {
      // clear any reject block for this pair: call started -> allow ICE
      try {
        const to = String(toUserId || "").trim();
        if (to) blockedIcePairs.delete(`${me}->${to}`);
      } catch {}
      const convId = String(conversationId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(convId)) return;
      const conv = await Conversation.findById(convId).select("participants").lean();
      if (!conv) return;
      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return;

      // defensive pre-check: ignore duplicate call-starts for same pair emitted rapidly
      try {
        const to = String(toUserId || "").trim();
        if (to) {
          const key = `${me}->${to}`;
          const prev = recentCallStarts.get(key);
          if (prev && Date.now() - prev < 5000) {
            console.log(`[webrtc] ignoring duplicate call-start (pre) from ${me}->${to} (dt=${Date.now()-prev}ms)`);
            return;
          }
        }
      } catch {}

      console.log(`[webrtc] call-start from ${me} in conv ${convId}`);
      const caller = await User.findById(me).select("fullName").lean().catch(() => null);
      const callerName = (caller && caller.fullName) ? String(caller.fullName) : "Unknown";
      const text = `${callerName} started a call`;
      const msg = await Message.create({ conversationId: convId, senderId: me, text, readBy: [me] });

      conv.lastMessageText = String(text).slice(0, 200);
      conv.lastMessageAt = msg.createdAt;
      await Conversation.findByIdAndUpdate(convId, { lastMessageText: conv.lastMessageText, lastMessageAt: conv.lastMessageAt }).catch(() => {});

      const payload = {
        id: String(msg._id),
        conversationId: convId,
        senderId: me,
        text: msg.text,
        createdAt: msg.createdAt,
      };

      io.to(convId).emit("message:new", payload);
      // also emit a call-start signal to the conversation room and optionally to the specific user
      io.to(convId).emit("webrtc:call-start", { fromUserId: me, conversationId: convId });
      const to = String(toUserId || "").trim();
      if (to) io.to(`user:${to}`).emit("webrtc:call-start", { fromUserId: me, conversationId: convId });
        // record recent call-start for this pair to avoid processing immediate rejects
        if (to) {
          const key = `${me}->${to}`;
          const prev = recentCallStarts.get(key);
          if (prev && Date.now() - prev < 5000) {
            console.log(`[webrtc] ignoring duplicate call-start from ${me}->${to} (dt=${Date.now()-prev}ms)`);
          } else {
            try {
              recentCallStarts.set(key, Date.now());
              // expire after 10s
              setTimeout(() => recentCallStarts.delete(key), 10 * 1000);
            } catch {}
          }
        }

        // Also record per-conversation call-start event for stronger call-end coalescing
        try {
          if (to) {
            const evKey = `${convId}:${me}`;
            recentCallEvents.set(evKey, { startTs: Date.now(), socketId: socket.id });
            setTimeout(() => recentCallEvents.delete(evKey), 15 * 1000);
          }
        } catch {}
      try {
        if (to) recentCallStarts.set(`${me}->${to}`, Date.now());
      } catch {}
    } catch (err) {
      console.error("[webrtc] call-start handler error:", err);
    }
  });

  socket.on("webrtc:call-end", async ({ conversationId, toUserId, durationSec }) => {
    try {
      const convId = String(conversationId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(convId)) return;
      const conv = await Conversation.findById(convId).select("participants").lean();
      if (!conv) return;
      const isMember = (conv.participants || []).map(String).includes(me);
      if (!isMember) return;

      const to = String(toUserId || "").trim();
      // defensive: ignore call-end events that arrive immediately after a recent call-start
      // for the same caller<->callee pair (race-condition mitigation). If `toUserId` is
      // not provided by the sender, check all other conversation participants.
      try {
        const candidates = [];
        const to = String(toUserId || "").trim();
        if (to) candidates.push(to);
        const others = (conv.participants || []).map(String).filter((p) => p && p !== me);
        for (const o of others) {
          if (!candidates.includes(o)) candidates.push(o);
        }

        for (const t of candidates) {
          try {
            const key1 = `${me}->${t}`;
            const key2 = `${t}->${me}`;
            const ts1 = recentCallStarts.get(key1);
            const ts2 = recentCallStarts.get(key2);
            const ts = ts1 || ts2;
            if (ts && Date.now() - ts < 3000) {
              console.log(`[webrtc] ignoring immediate call-end for ${me}<->${t} (dt=${Date.now()-ts}ms)`);
              return;
            }
            // stronger check: if there is a per-conversation call-start by this user
            try {
              const evKey = `${convId}:${me}`;
              const ev = recentCallEvents.get(evKey);
              if (ev && ev.startTs && Date.now() - ev.startTs < 2000 && (!durationSec || durationSec <= 1) && ev.socketId === socket.id) {
                console.log(`[webrtc] ignoring immediate call-end based on recentCallEvents for ${me} in conv ${convId} (dt=${Date.now()-ev.startTs}ms, socket=${socket.id})`);
                return;
              }
            } catch {}
          } catch {}
        }
      } catch {}

      console.log(`[webrtc] call-end from ${me} in conv ${convId} dur=${durationSec} (socket=${socket.id})`);
      const caller = await User.findById(me).select("fullName").lean().catch(() => null);
      const callerName = (caller && caller.fullName) ? String(caller.fullName) : "Unknown";
      const durText = typeof durationSec === "number" ? ` (duration ${Math.floor(durationSec)}s)` : "";
      const text = `${callerName} ended the call${durText}`;
      const msg = await Message.create({ conversationId: convId, senderId: me, text, readBy: [me] });

      conv.lastMessageText = String(text).slice(0, 200);
      conv.lastMessageAt = msg.createdAt;
      await Conversation.findByIdAndUpdate(convId, { lastMessageText: conv.lastMessageText, lastMessageAt: conv.lastMessageAt }).catch(() => {});

      const payload = {
        id: String(msg._id),
        conversationId: convId,
        senderId: me,
        text: msg.text,
        createdAt: msg.createdAt,
      };

      io.to(convId).emit("message:new", payload);
      // also emit a call-end signal to the conversation room and optionally to the specific user
      io.to(convId).emit("webrtc:call-end", { fromUserId: me, conversationId: convId, durationSec, fromSocketId: socket.id });
      if (to) io.to(`user:${to}`).emit("webrtc:call-end", { fromUserId: me, conversationId: convId, durationSec, fromSocketId: socket.id });
    } catch (err) {
      console.error("[webrtc] call-end handler error:", err);
    }
  });

  socket.on("webrtc:reject", ({ toUserId }) => {
    try {
      const to = String(toUserId || "").trim();
      console.log(`[webrtc] reject from ${me} -> ${to}`);
      if (!to) return;
      // defensive: ignore rejects that arrive immediately after a call-start from same caller
      try {
        const key = `${me}->${to}`;
        const ts = recentCallStarts.get(key);
        if (ts && Date.now() - ts < 3000) {
          console.log(`[webrtc] ignoring immediate reject for ${key} (dt=${Date.now()-ts}ms)`);
          return;
        }
      } catch {}
      // mark pair as blocked for a short period so we don't forward lingering ICE
      try {
        const key = `${me}->${to}`;
        blockedIcePairs.add(key);
        // clear after 30s
        setTimeout(() => blockedIcePairs.delete(key), 30 * 1000);
      } catch {}
      // include socket id for debugging so we can trace which connection emitted the reject
      const payload = { fromUserId: me, fromSocketId: socket.id };
      io.to(`user:${to}`).emit("webrtc:reject", payload);
      console.log(`[webrtc] reject forwarded to user:${to} (fromSocketId=${socket.id})`);
    } catch (err) {
      console.error("[webrtc] reject handler error:", err);
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
