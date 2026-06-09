import { config } from '../config.js';

const hits = new Map();

export function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const max = config.rateLimit.max;

  if (!hits.has(ip)) {
    hits.set(ip, []);
  }

  const timestamps = hits.get(ip).filter((t) => now - t < windowMs);
  timestamps.push(now);
  hits.set(ip, timestamps);

  if (timestamps.length > max) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of hits) {
    const valid = timestamps.filter((t) => now - t < config.rateLimit.windowMs);
    if (valid.length === 0) {
      hits.delete(ip);
    } else {
      hits.set(ip, valid);
    }
  }
}, 60000).unref();
