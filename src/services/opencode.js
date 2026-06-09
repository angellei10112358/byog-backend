import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';

function buildInitialPrompt(description) {
  return `Create a complete, self-contained single-file HTML game based on this description: "${description}".
Requirements:
- Write everything into a file named game.html in the current directory.
- All CSS and JavaScript must be inline in that one file. No external files, no CDN links, no network requests.
- The game must be fully playable by just opening game.html.
Only modify game.html.`;
}

function buildEditPrompt(userMessage) {
  return `The user is testing the game in game.html and reports: "${userMessage}".
Fix or adjust game.html accordingly. Keep it a single self-contained file with all CSS/JS inline and no external resources. Only modify game.html.`;
}

function runOpencode(args, workdir, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('opencode', args, {
      cwd: workdir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`opencode timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`opencode exited with code ${code}\nstderr: ${stderr.slice(-2000)}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn opencode: ${err.message}`));
    });
  });
}

async function readGameHtml(workdir) {
  const gamePath = join(workdir, 'game.html');
  if (!existsSync(gamePath)) {
    throw new Error('game.html was not created by opencode');
  }
  return await readFile(gamePath, 'utf-8');
}

function guessSessionIdFromStdout(stdout) {
  const match = stdout.match(/(?:session|Session)\s*(?:ID|id)?[:\s]+([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

export async function generateGame(sessionId, workdir, description) {
  const args = [
    'run',
    '--agent', 'autoaccept',
    '--model', config.opencodeModel,
    buildInitialPrompt(description),
  ];

  await runOpencode(args, workdir, config.opencodeTimeout);
  const html = await readGameHtml(workdir);
  return { html, opencodeSessionId: null };
}

export async function editGame(sessionId, workdir, opencodeSessionId, userMessage) {
  const args = [
    'run',
    '--agent', 'autoaccept',
    '--model', config.opencodeModel,
    '--session', opencodeSessionId,
    buildEditPrompt(userMessage),
  ];

  const { stdout } = await runOpencode(args, workdir, config.opencodeTimeout);
  const html = await readGameHtml(workdir);

  const parsedSessionId = guessSessionIdFromStdout(stdout);

  return { html, opencodeSessionId: parsedSessionId || opencodeSessionId };
}
