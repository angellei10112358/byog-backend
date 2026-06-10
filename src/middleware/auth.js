import { config } from '../config.js';

export function requireAuth(req, res, next) {
  if (!config.apiKey) return next();

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  if (header.slice(7) !== config.apiKey) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
