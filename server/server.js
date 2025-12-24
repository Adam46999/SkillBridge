// server/server.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");

// routes
const pointsRoutes = require("./routes/points.routes"); // زي ما عندك
const sessionsRouter = require("./routes/sessions");
const usersRouter = require("./routes/users");

// matching service (إذا موجود عندك)
const { findMentorMatches } = require("./services/matchingService");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== ENV & DB =====
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

// ===== Auth Middleware =====
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

// ===== Health =====
app.get("/", (req, res) => res.send("SkillBridge API is running ✅"));

// ===== Matching status =====
app.get("/api/matching/status", (req, res) => {
  const mode = process.env.MATCHING_MODE || "local";
  res.json({
    ok: true,
    mode,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    embedModel: process.env.OPENAI_EMBED_MODEL || null,
  });
});

// ===== Auth =====
app.post("/auth/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const exists = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });
    if (exists) return res.status(409).json({ error: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: String(fullName).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash: hashed,
      points: 0,
      xp: 0,
      streak: 0,
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
      },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
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
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

// ===== Me =====
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

// ===== Update profile =====
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

// ===== Mentor matches =====
app.post("/api/matches/mentors", authMiddleware, async (req, res) => {
  try {
    const modeFromQuery = String((req.query || {}).mode || "").trim();
    const modeFromBody = String((req.body || {}).mode || "").trim();
    const mode = modeFromQuery || modeFromBody || "";

    const payload = req.body || {};
    const params = { ...payload, userId: String(req.userId), mode };

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

// ===== Other routes =====
app.use("/api/points", authMiddleware, pointsRoutes);
app.use("/api/sessions", sessionsRouter(authMiddleware));
app.use("/api/users", usersRouter(authMiddleware)); // ✅ mentor profile API

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
