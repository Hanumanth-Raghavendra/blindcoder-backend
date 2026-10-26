/**
 * Minimal per-IP fixed-window rate limiter. Protects the free AI quotas from
 * being drained by a single client or bot. No external dependencies.
 */
export function rateLimit({ perMinute, name = "requests" }) {
  const windowMs = 60 * 1000;
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.reset < now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > perMinute) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: `Too many ${name}. Please wait ${retryAfter} seconds and try again.`,
      });
    }
    next();
  };
}
