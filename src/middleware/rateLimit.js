// Simple, lightweight limiter (per-process). For production, use a store (Redis).
const hits = new Map();

export function tinyRateLimit(windowMs = 10000, max = 100) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const win = hits.get(ip) || [];
    const fresh = win.filter((t) => now - t < windowMs);
    fresh.push(now);
    hits.set(ip, fresh);
    if (fresh.length > max)
      return res.status(429).json({ message: 'Too many requests' });
    next();
  };
}
