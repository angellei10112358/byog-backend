import { spawn, execSync } from 'node:child_process';
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

const MAX_BUF = 10000;

function runOpencode(args, workdir, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    // --- DIAG: pre-flight checks ---
    try {
      const shOk = execSync('/bin/sh -c "echo ok"', { timeout: 3000, encoding: 'utf-8' });
      console.log('[diag] step1 spawn+shell:', JSON.stringify(shOk.trim()));
    } catch (e) {
      console.log('[diag] step1 spawn+shell FAILED:', e.message);
    }

    try {
      const ver = execSync('opencode --version', { timeout: 5000, encoding: 'utf-8' });
      console.log('[diag] step2 opencode version:', ver.trim());
    } catch (e) {
      console.log('[diag] step2 opencode version FAILED:', e.message, e.stderr?.slice(-500));
    }

    try {
      const auth = execSync('opencode auth list', { timeout: 5000, encoding: 'utf-8' });
      console.log('[diag] step3 auth list:', auth.trim());
    } catch (e) {
      console.log('[diag] step3 auth list FAILED:', e.message, e.stderr?.slice(-500));
    }

    try {
      const model = config.opencodeModel;
      const shortPrompt = 'Write a single HTML file with hello world.';
      const testRun = execSync(`opencode run --model "${model}" "${shortPrompt}"`, { cwd: workdir, timeout: 15000, encoding: 'utf-8' });
      console.log('[diag] step4 test run stdout:', testRun.slice(-1000));
    } catch (e) {
      console.log('[diag] step4 test run FAILED:', e.message);
      console.log('[diag] step4 test run stderr:', e.stderr?.slice(-2000));
    }

    console.log('[opencode] spawning:', args.join(' '));
    const child = spawn('opencode', args, {
      cwd: workdir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > MAX_BUF * 2) stderr = stderr.slice(-MAX_BUF);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`opencode timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      child.kill('SIGTERM');
      cleanup();
      reject(new Error('Request cancelled'));
    };

    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    child.on('close', (code, sig) => {
      cleanup();
      console.log('[opencode] exit code:', code, 'signal:', sig);
      console.log('[opencode] stdout tail:', stdout.slice(-1500));
      console.log('[opencode] stderr tail:', stderr.slice(-2000));
      if (code !== 0) {
        if (code === null && !stdout && !stderr) {
          try {
            const fb = execSync(`opencode ${args.join(' ')}`, { cwd: workdir, timeout: 10000, encoding: 'utf-8' });
            console.log('[opencode] exec fallback stdout:', fb.slice(-1500));
          } catch (e) {
            console.log('[opencode] exec fallback error:', e.message);
            console.log('[opencode] exec fallback stderr:', e.stderr?.slice(-2000));
          }
        }
        reject(new Error(`opencode exited with code ${code} signal ${sig}\nstderr: ${stderr.slice(-2000)}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.on('error', (err) => {
      cleanup();
      reject(new Error(`Failed to spawn opencode: ${err.message}`));
    });
  });
}

function guessSessionIdFromStdout(stdout) {
  const match = stdout.match(/(?:session|Session)\s*(?:ID|id)?[:\s]+([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

export async function generateGame(sessionId, workdir, description, signal) {
  const args = [
    'run',
    '--model', config.opencodeModel,
    buildInitialPrompt(description, workdir),
  ];

  const { stdout } = await runOpencode(args, workdir, config.opencodeTimeout, signal);
  const html = await readGameHtml(workdir);
  const opencodeSessionId = guessSessionIdFromStdout(stdout);
  return { html, opencodeSessionId };
}

export async function editGame(sessionId, workdir, opencodeSessionId, userMessage, signal) {
  const args = [
    'run',
    '--model', config.opencodeModel,
    '--session', opencodeSessionId,
    buildEditPrompt(userMessage, workdir),
  ];

  const { stdout } = await runOpencode(args, workdir, config.opencodeTimeout, signal);
  const html = await readGameHtml(workdir);
  const parsedSessionId = guessSessionIdFromStdout(stdout);
  return { html, opencodeSessionId: parsedSessionId || opencodeSessionId };
}

export async function generateFromExisting(workdir, userMessage, signal) {
  const args = [
    'run',
    '--model', config.opencodeModel,
    buildEditPrompt(userMessage, workdir),
  ];

  const { stdout } = await runOpencode(args, workdir, config.opencodeTimeout, signal);
  const html = await readGameHtml(workdir);
  const opencodeSessionId = guessSessionIdFromStdout(stdout);
  return { html, opencodeSessionId };
}

async function readGameHtml(workdir) {
  const gamePath = join(workdir, 'game.html');
  if (!existsSync(gamePath)) {
    throw new Error('game.html was not created by opencode');
  }
  const html = await readFile(gamePath, 'utf-8');
  if (!html || html.trim().length < 50) {
    throw new Error('game.html is empty or incomplete');
  }
  return html;
}
