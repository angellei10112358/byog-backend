import { Router } from 'express';
import { getSession, getVersions } from '../store.js';

const router = Router();

router.get('/:sessionId/versions', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ versions: getVersions(session.sessionId) });
});

export default router;
