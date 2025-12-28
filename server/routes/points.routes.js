// server/routes/points.routes.js
const express = require("express");
const PointTransaction = require("../models/PointTransaction");
const { getBalance } = require("../services/pointsService");

const router = express.Router();

/**
 * GET /api/points/balance
 * returns: { balance: number }
 */
router.get("/balance", async (req, res) => {
  try {
    const balance = await getBalance(req.userId);
    return res.json({ balance });
  } catch (err) {
    return res.status(400).json({ error: String(err.message || err) });
  }
});

/**
 * GET /api/points/transactions?limit=50
 * returns: { items: PointTransaction[] }
 */
router.get("/transactions", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, rawLimit))
      : 50;

    const items = await PointTransaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("amount reason sessionId balanceAfter createdAt");

    return res.json({ items });
  } catch (err) {
    return res.status(400).json({ error: String(err.message || err) });
  }
});

module.exports = router;
