import { Router } from 'express';
import { getSession, setOpencodeSessionId, addVersion } from '../store.js';
import { generateGame, editGame } from '../services/opencode.js';

const router = Router();

router.post('/:sessionId/messages', async (req, res, next) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'message is required and must be a non-empty string' });
      return;
    }

    if (!session.opencodeSessionId) {
      const { html, opencodeSessionId } = await generateGame(
        session.sessionId,
        session.workdir,
        message,
      );
      if (opencodeSessionId) {
        setOpencodeSessionId(session.sessionId, opencodeSessionId);
      }
      const version = addVersion(session.sessionId, html, 'Initial generation');
      res.status(200).json({
        versionId: version.versionId,
        html: version.html,
        createdAt: version.createdAt,
      });
    } else {
      const { html } = await editGame(
        session.sessionId,
        session.workdir,
        session.opencodeSessionId,
        message,
      );
      const version = addVersion(session.sessionId, html, `Edit: ${message.slice(0, 80)}`);
      res.status(200).json({
        versionId: version.versionId,
        html: version.html,
        createdAt: version.createdAt,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
