// Simple in-memory idempotency cache for request deduplication
// Stores responses for completed idempotent requests and locks in-flight requests

const cache = new Map();
const IN_FLIGHT = 'IN_FLIGHT';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired keys periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt && value.expiresAt < now) {
      cache.delete(key);
    }
  }
}, 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

const idempotency = (req, res, next) => {
  const key = req.headers['idempotency-key'] || req.body?.idempotencyKey;
  if (!key) {
    return next();
  }

  const existing = cache.get(key);
  if (existing) {
    if (existing.status === IN_FLIGHT) {
      return res.status(409).json({
        message: 'الطلب قيد المعالجة بالفعل، يرجى الانتظار لتجنب التكرار',
      });
    }
    // Return cached response
    return res.status(existing.statusCode).json(existing.body);
  }

  // Mark key as in flight
  cache.set(key, { status: IN_FLIGHT, expiresAt: Date.now() + 30000 });

  // Intercept json response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    cache.set(key, {
      status: 'COMPLETED',
      statusCode: res.statusCode || 200,
      body,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return originalJson(body);
  };

  next();
};

module.exports = idempotency;
