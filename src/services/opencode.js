import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';

function buildInitialPrompt(description, workdir) {
  return `Create a complete, self-contained single-file HTML game based on this description: "${description}".
Requirements:
- Write everything into a file named ${workdir}/game.html.
- All CSS and JavaScript must be inline in that one file. No external files, no CDN links, no network requests.
- The game must be fully playable by just opening game.html.
Only modify ${workdir}/game.html.`;
}

function buildEditPrompt(userMessage, workdir) {
  return `The user is testing the game in game.html and reports: "${userMessage}".
Fix or adjust ${workdir}/game.html accordingly. Keep it a single self-contained file with all CSS/JS inline and no external resources. Only modify ${workdir}/game.html.`;
}

function runOpencode(args, workdir, timeoutMs) {
  return new Promise((resolve, reject) => {
    console.log('[opencode] spawning:', args.join(' '));
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
      console.log('[opencode] exit code:', code);
      console.log('[opencode] stdout tail:', stdout.slice(-1500));
      console.log('[opencode] stderr tail:', stderr.slice(-1500));
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

function guessSessionIdFromStdout(stdout) {
  const match = stdout.match(/(?:session|Session)\s*(?:ID|id)?[:\s]+([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

export async function generateGame(sessionId, workdir, description) {
  const args = [
    'run',
    '--model', config.opencodeModel,
    buildInitialPrompt(description, workdir),
  ];

  const { stdout, stderr } = await runOpencode(args, workdir, config.opencodeTimeout);
  const html = await readGameHtml(workdir, stdout, stderr);
  const opencodeSessionId = guessSessionIdFromStdout(stdout);
  return { html, opencodeSessionId };
}

export async function editGame(sessionId, workdir, opencodeSessionId, userMessage) {
  const args = [
    'run',
    '--model', config.opencodeModel,
    '--session', opencodeSessionId,
    buildEditPrompt(userMessage, workdir),
  ];

  const { stdout, stderr } = await runOpencode(args, workdir, config.opencodeTimeout);
  const html = await readGameHtml(workdir, stdout, stderr);

  const parsedSessionId = guessSessionIdFromStdout(stdout);

  return { html, opencodeSessionId: parsedSessionId || opencodeSessionId };
}

export async function generateFromExisting(workdir, userMessage) {
  const args = [
    'run',
    '--model', config.opencodeModel,
    buildEditPrompt(userMessage, workdir),
  ];

  const { stdout, stderr } = await runOpencode(args, workdir, config.opencodeTimeout);
  const html = await readGameHtml(workdir, stdout, stderr);
  const opencodeSessionId = guessSessionIdFromStdout(stdout);
  return { html, opencodeSessionId };
}

async function readGameHtml(workdir, stdout = '', stderr = '') {
  const gamePath = join(workdir, 'game.html');
  if (!existsSync(gamePath)) {
    const detail = `stdout:\n${stdout.slice(-2000)}\n\nstderr:\n${stderr.slice(-2000)}`;
    throw new Error(`game.html was not created by opencode.\n${detail}`);
  }
  return await readFile(gamePath, 'utf-8');
}
