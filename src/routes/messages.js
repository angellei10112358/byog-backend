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

    const normalized = message.trim().toLowerCase();
    const prebuiltKey = Object.keys(PREBUILT_GAMES).find(k => normalized === k || normalized === k.replace(/\s+/g, ''));
    if (prebuiltKey) {
      const html = getPrebuiltHtml(prebuiltKey);
      const version = addVersion(session.sessionId, html, PREBUILT_GAMES[prebuiltKey].label);
      res.status(200).json({
        versionId: version.versionId,
        prebuilt: true,
        html: version.html,
        createdAt: version.createdAt,
      });
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
