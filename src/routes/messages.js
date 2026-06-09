import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSession, setOpencodeSessionId, addVersion } from '../store.js';
import { generateGame, editGame } from '../services/opencode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(__dirname, '..', 'cases');

const PREBUILT_GAMES = {
  tetris:        { file: 'tetris.html',        label: 'Tetris' },
  'battle city': { file: 'battle_city.html',   label: 'Battle City' },
  'dragon quest':{ file: 'dragon_quest.html',  label: 'Dragon Quest' },
  minesweeper:   { file: 'minesweeper.html',   label: 'Minesweeper' },
  sudoku:        { file: 'sudoku.html',        label: 'Sudoku' },
  'chinese chess':{file: 'chinese_chess.html', label: 'Chinese Chess' },
  2048:          { file: '2048-game.html',     label: '2048' },
};

const prebuiltHtmlCache = {};

function getPrebuiltHtml(key) {
  if (prebuiltHtmlCache[key]) return prebuiltHtmlCache[key];
  const game = PREBUILT_GAMES[key];
  if (!game) return null;
  const path = join(CASES_DIR, game.file);
  prebuiltHtmlCache[key] = readFileSync(path, 'utf-8');
  return prebuiltHtmlCache[key];
}

function withHeartbeat(res, work) {
  return new Promise((resolve) => {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.write('\n');
    const heartbeat = setInterval(() => {
      try { res.write('\n'); } catch { clearInterval(heartbeat); }
    }, 30000);
    work()
      .then((result) => {
        clearInterval(heartbeat);
        resolve(result);
      })
      .catch((err) => {
        clearInterval(heartbeat);
        resolve({ error: err.message });
      });
  });
}

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

    const normalized = message.trim();
    const PRE_CMD = '$pre-case$';
    if (normalized.startsWith(PRE_CMD)) {
      const key = normalized.slice(PRE_CMD.length).trim().toLowerCase();
      const game = PREBUILT_GAMES[key];
      if (game) {
        const html = getPrebuiltHtml(key);
        const version = addVersion(session.sessionId, html, game.label);
        res.status(200).json({
          versionId: version.versionId,
          prebuilt: true,
          html: version.html,
          createdAt: version.createdAt,
        });
        return;
      }
    }

    const work = session.opencodeSessionId
      ? async () => {
          const { html } = await editGame(session.sessionId, session.workdir, session.opencodeSessionId, message);
          const version = addVersion(session.sessionId, html, `Edit: ${message.slice(0, 80)}`);
          return { versionId: version.versionId, html: version.html, createdAt: version.createdAt };
        }
      : async () => {
          const { html, opencodeSessionId } = await generateGame(session.sessionId, session.workdir, message);
          if (opencodeSessionId) setOpencodeSessionId(session.sessionId, opencodeSessionId);
          const version = addVersion(session.sessionId, html, 'Initial generation');
          return { versionId: version.versionId, html: version.html, createdAt: version.createdAt };
        };

    const result = await withHeartbeat(res, work);
    if (!res.writableEnded) res.end(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

export default router;
