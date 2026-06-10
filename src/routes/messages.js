import { Router } from 'express';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSession, setOpencodeSessionId, addVersion } from '../store.js';
import { generateGame, editGame, generateFromExisting } from '../services/opencode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(__dirname, '..', 'cases');

const PREBUILT_GAMES = {
  tetris:        { file: 'tetris.html',        label: 'Tetris' },
  'battle city': { file: 'battle_city.html',   label: 'Battle City' },
  'dragon quest':{ file: 'dragon_quest.html',  label: 'Dragon Quest' },
  minesweeper:   { file: 'minesweeper.html',   label: 'Minesweeper' },
  sudoku:        { file: 'sudoku.html',        label: 'Sudoku' },
  'chinese chess':{file: 'chinese_chess.html', label: 'Chinese Chess' },
  'bubble shooter':{file: 'bubble_shooter.html', label: 'Bubble Shooter' },
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

function withHeartbeat(res, work, signal) {
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
        if (signal?.aborted) resolve({ cancelled: true });
        else resolve({ error: err.message });
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
        const version = await addVersion(session.sessionId, html, game.label, session.workdir);
        res.status(200).json({
          versionId: version.versionId,
          prebuilt: true,
          html,
          createdAt: version.createdAt,
        });
        return;
      }
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const { previousGameHtml } = req.body;
    const signal = controller.signal;
    const work = previousGameHtml
      ? async () => {
          writeFileSync(join(session.workdir, 'game.html'), previousGameHtml);
          const { html, opencodeSessionId } = await generateFromExisting(session.workdir, message, signal);
          if (opencodeSessionId) setOpencodeSessionId(session.sessionId, opencodeSessionId);
          const version = await addVersion(session.sessionId, html, `Edit: ${message.slice(0, 80)}`, session.workdir);
          return { versionId: version.versionId, html, createdAt: version.createdAt };
        }
      : session.opencodeSessionId
        ? async () => {
            const { html } = await editGame(session.sessionId, session.workdir, session.opencodeSessionId, message, signal);
            const version = await addVersion(session.sessionId, html, `Edit: ${message.slice(0, 80)}`, session.workdir);
            return { versionId: version.versionId, html, createdAt: version.createdAt };
          }
        : async () => {
            const { html, opencodeSessionId } = await generateGame(session.sessionId, session.workdir, message, signal);
            if (opencodeSessionId) setOpencodeSessionId(session.sessionId, opencodeSessionId);
            const version = await addVersion(session.sessionId, html, 'Initial generation', session.workdir);
            return { versionId: version.versionId, html, createdAt: version.createdAt };
          };

    const result = await withHeartbeat(res, work, signal);
    if (!res.writableEnded) res.end(JSON.stringify(result));
  } catch (err) {
    next(err);
  }
});

export default router;
