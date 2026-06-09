import { Router } from 'express';
import { execSync } from 'node:child_process';

const router = Router();

router.get('/health', (req, res) => {
  try {
    const version = execSync('opencode --version', { encoding: 'utf-8', timeout: 10000 }).trim();
    res.json({ status: 'ok', opencodeVersion: version });
  } catch {
    res.status(503).json({ status: 'error', message: 'opencode CLI not available' });
  }
});

export default router;
