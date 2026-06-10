import { Router } from 'express';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createSession, getSession } from '../store.js';
import { config } from '../config.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const session = createSession();
    const workdir = join(config.workspacesRoot, session.sessionId);
    await mkdir(workdir, { recursive: true });
    await mkdir(join(workdir, 'versions'), { recursive: true });
    session.workdir = workdir;
    res.status(200).json({ sessionId: session.sessionId });
  } catch (err) {
    next(err);
  }
});

router.get('/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ sessionId: session.sessionId, createdAt: session.createdAt });
});

export default router;
