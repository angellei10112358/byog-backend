import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const sessions = new Map();

function touchSession(session) {
  session.lastAccessedAt = Date.now();
}

export function createSession() {
  const sessionId = randomUUID();
  const session = {
    sessionId,
    workdir: null,
    opencodeSessionId: null,
    versions: [],
    createdAt: new Date().toISOString(),
    lastAccessedAt: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId) || null;
  if (session) touchSession(session);
  return session;
}

export function setOpencodeSessionId(sessionId, opencodeSessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.opencodeSessionId = opencodeSessionId;
    touchSession(session);
  }
}

export async function addVersion(sessionId, html, label, workdir) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  touchSession(session);

  const versionId = `v${session.versions.length + 1}`;
  const version = { versionId, label, createdAt: new Date().toISOString() };

  const versionPath = join(workdir, 'versions', `${versionId}.html`);
  await writeFile(versionPath, html, 'utf-8');

  session.versions.push(version);
  return version;
}

export async function getVersionHtml(sessionId, versionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.workdir) return null;
  const path = join(session.workdir, 'versions', `${versionId}.html`);
  if (!existsSync(path)) return null;
  return await readFile(path, 'utf-8');
}

export function getVersions(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.versions;
}

export function getAllSessions() {
  return Array.from(sessions.values());
}

export function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (session.workdir) {
    try { rmSync(session.workdir, { recursive: true, force: true }); } catch {}
  }
  sessions.delete(sessionId);
  return true;
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.lastAccessedAt < cutoff) {
      console.log(`[cleanup] Removing expired session ${id}`);
      if (session.workdir) {
        try { rmSync(session.workdir, { recursive: true, force: true }); } catch {}
      }
      sessions.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();