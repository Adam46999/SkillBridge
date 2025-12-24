// server/matching/embeddingService.js
const OpenAI = require("openai");

let client = null;

// ===== In-memory cache (no external deps) =====
const CACHE_TTL_MS =
  Number(process.env.EMBED_CACHE_TTL_MS) || 1000 * 60 * 60 * 24; // 24h
const CACHE_MAX_ITEMS = Number(process.env.EMBED_CACHE_MAX_ITEMS) || 2000;

// key -> { value: number[], expiresAt: number, touchedAt: number }
const cache = new Map();

// key -> Promise<number[]|null>
const inFlight = new Map();

function now() {
  return Date.now();
}

function normalizeKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

function purgeExpired() {
  const t = now();
  for (const [k, entry] of cache.entries()) {
    if (!entry || entry.expiresAt <= t) cache.delete(k);
  }
}

function evictIfNeeded() {
  if (cache.size <= CACHE_MAX_ITEMS) return;

  // Evict least-recently-touched entries
  const items = Array.from(cache.entries());
  items.sort((a, b) => (a[1]?.touchedAt || 0) - (b[1]?.touchedAt || 0));

  const removeCount = Math.ceil(CACHE_MAX_ITEMS * 0.15); // remove 15%
  for (let i = 0; i < removeCount && i < items.length; i++) {
    cache.delete(items[i][0]);
  }
}

function hasUsableKey() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  return !!apiKey && apiKey !== "YOUR_KEY_HERE";
}

function getClientSafe() {
  // IMPORTANT: never throw here (we want clean fallback UX)
  if (!hasUsableKey()) return null;

  if (client) return client;

  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function getModel() {
  return process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
}

/**
 * Returns embedding vector for a text
 * - returns null if:
 *   - empty text
 *   - no API key
 *   - OpenAI error
 *
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
async function getEmbedding(text) {
  const input = String(text || "").trim();
  if (!input) return null;

  // no key => no embedding (caller should fallback)
  const openai = getClientSafe();
  if (!openai) return null;

  const key = normalizeKey(input);

  // keep cache healthy
  purgeExpired();

  // 1) cache hit
  const cached = cache.get(key);
  if (cached && Array.isArray(cached.value) && cached.value.length > 0) {
    cached.touchedAt = now();
    return cached.value;
  }

  // 2) in-flight dedupe
  const existingPromise = inFlight.get(key);
  if (existingPromise) return existingPromise;

  // 3) fetch + store
  const promise = (async () => {
    try {
      const model = getModel();

      const resp = await openai.embeddings.create({
        model,
        input,
      });

      const emb = resp?.data?.[0]?.embedding;
      if (!Array.isArray(emb) || emb.length === 0) return null;

      cache.set(key, {
        value: emb,
        expiresAt: now() + CACHE_TTL_MS,
        touchedAt: now(),
      });

      evictIfNeeded();
      return emb;
    } catch (err) {
      // silent fail => caller can fallback (hybrid/local)
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

module.exports = { getEmbedding };
