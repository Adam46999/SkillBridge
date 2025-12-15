// server/server.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 👇 موديل اليوزر من نفس الفولدر (./) مش ../
const User = require("./models/User");

// ✅ NEW: matching router (index.js) — local/openai/hybrid
const { findMentorMatches } = require("./matching");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== ENV & DB =====
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret-123";
const PORT = process.env.PORT || 4000;

console.log("Loaded MONGO_URI?", !!MONGO_URI);
console.log("Loaded JWT_SECRET?", !!process.env.JWT_SECRET);
console.log("JWT_SECRET used:", JWT_SECRET);
console.log("MATCHING_MODE:", process.env.MATCHING_MODE || "local");

// تأكد إن MONGO_URI موجود
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env – check your file.");
  process.exit(1);
}

// اتصال بـ MongoDB Atlas
mongoose
  .connect(MONGO_URI, {
    dbName: "myapp",
  })
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

// ===== Helpers =====
function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

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
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ✅ Matching readiness helper (used by /api/matching/status)
function getOpenAIStatus() {
  const raw = String(process.env.OPENAI_API_KEY || "").trim();
  const hasKey = !!raw && raw !== "YOUR_KEY_HERE";

  if (!hasKey) {
    return {
      openaiAvailable: false,
      reason: "NO_KEY",
      recommendedMode: "local", // safest default if no key
    };
  }

  return {
    openaiAvailable: true,
    reason: "OK",
    recommendedMode: "hybrid", // best UX when available
  };
}

// ===== Routes =====

// Health check
app.get("/", (req, res) => {
  res.json({ message: "SkillSwap backend alive 💀🔥" });
});

// ✅ Matching status (no auth needed, safe + fast)
app.get("/api/matching/status", (req, res) => {
  try {
    return res.json(getOpenAIStatus());
  } catch (err) {
    return res.json({
      openaiAvailable: false,
      reason: "ERROR",
      recommendedMode: "local",
    });
  }
});

// ---------- SIGNUP ----------
app.post("/auth/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: "Email already used" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email: normalizedEmail,
      passwordHash,
      points: 0,
      xp: 0,
      streak: 0,
      skillsToLearn: [],
      skillsToTeach: [],
      availabilitySlots: [],
    });

    const token = createToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        points: user.points,
        xp: user.xp,
        streak: user.streak,
      },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({
      error: "Signup failed",
      details: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

// ---------- LOGIN ----------
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = createToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        points: user.points,
        xp: user.xp,
        streak: user.streak,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      error: "Login failed",
      details: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

// ---------- GET CURRENT USER ----------
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("GET /api/me ERROR:", err);
    res.status(500).json({
      error: "Failed to load user",
      details: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

// ---------- UPDATE PROFILE (skills & availability) ----------
app.put("/api/me/profile", authMiddleware, async (req, res) => {
  try {
    const { skillsToLearn, skillsToTeach, availabilitySlots } = req.body;

    console.log("PUT /api/me/profile BODY:", JSON.stringify(req.body, null, 2));

    const update = {};

    // ✅ skillsToLearn supports BOTH string[] and object[]
    if (Array.isArray(skillsToLearn)) {
      update.skillsToLearn = skillsToLearn
        .map((item) => {
          if (typeof item === "string") {
            const name = item.trim();
            if (!name) return null;
            return { name, level: "Not specified" };
          }

          if (
            item &&
            typeof item === "object" &&
            typeof item.name === "string"
          ) {
            const name = String(item.name).trim();
            if (!name) return null;

            const level = String(item.level || "").trim() || "Not specified";
            return { name, level };
          }

          return null;
        })
        .filter(Boolean);
    }

    if (Array.isArray(skillsToTeach)) {
      update.skillsToTeach = skillsToTeach
        .filter((s) => s && s.name)
        .map((s) => ({
          name: String(s.name).trim(),
          level: String(s.level || "").trim() || "Not specified",
        }));
    }

    if (Array.isArray(availabilitySlots)) {
      update.availabilitySlots = availabilitySlots
        .filter(
          (slot) =>
            typeof slot.dayOfWeek === "number" &&
            slot.dayOfWeek >= 0 &&
            slot.dayOfWeek <= 6 &&
            slot.from &&
            slot.to
        )
        .map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          from: String(slot.from),
          to: String(slot.to),
        }));
    }

    const user = await User.findByIdAndUpdate(req.userId, update, {
      new: true,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    console.error("PUT /api/me/profile ERROR:", err);
    res.status(500).json({
      error: "Failed to update profile",
      details: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

// ---------- FORGOT PASSWORD ----------
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.json({
        message:
          "If an account with that email exists, a reset code has been generated.",
      });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.passwordResetCode = resetCode;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const response = {
      message:
        "If an account with that email exists, a reset code has been generated.",
    };

    if (process.env.NODE_ENV !== "production") {
      response.devResetCode = resetCode;
    }

    return res.json(response);
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({
      error: "Failed to process password reset request",
      details: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

// ---------- RESET PASSWORD ----------
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
      passwordResetCode: code,
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid reset code or email. Please try again." });
    }

    if (
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({
        error: "This reset code has expired. Please request a new one.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    user.passwordHash = passwordHash;
    user.passwordResetCode = null;
    user.passwordResetExpires = null;

    await user.save();

    return res.json({
      message: "Your password has been updated successfully.",
    });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({
      error: "Failed to reset password",
      details: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

// ---------- MENTOR MATCHING ----------
app.post("/api/matches/mentors", authMiddleware, async (req, res) => {
  try {
    const { skill, level, availabilitySlots, mode } = req.body;

    if (!skill || !level) {
      return res.status(400).json({ error: "Skill and level are required." });
    }

    const userAvailability = Array.isArray(availabilitySlots)
      ? availabilitySlots
      : [];

    // ✅ call matching layer
    const out = await findMentorMatches({
      userId: req.userId,
      skillQuery: skill,
      level,
      userAvailability,
      mode, // ✅ هذا اللي بخليك تغيّر من قلب الاب
    });

    // ✅ Backward compatible:
    // - old behavior: out is an array => results only
    // - new behavior: out is { results, meta }
    if (Array.isArray(out)) {
      return res.json({
        results: out,
        meta: {
          requestedMode: mode || null,
          modeUsed: null,
          fallbackUsed: false,
        },
      });
    }

    const results = Array.isArray(out?.results) ? out.results : [];
    const meta = out?.meta || {
      requestedMode: mode || null,
      modeUsed: null,
      fallbackUsed: false,
    };

    return res.json({ results, meta });
  } catch (err) {
    console.error("MATCHING ERROR:", err);
    res.status(500).json({
      error: "Failed to find mentor matches",
      details: err instanceof Error ? err.message : "Unknown server error",
    });
  }
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
