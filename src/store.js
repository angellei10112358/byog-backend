import { randomUUID } from 'node:crypto';

const sessions = new Map();

export function createSession() {
  const sessionId = randomUUID();
  const session = {
    sessionId,
    workdir: null,
    opencodeSessionId: null,
    versions: [],
    createdAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function setOpencodeSessionId(sessionId, opencodeSessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.opencodeSessionId = opencodeSessionId;
  }
}

export function addVersion(sessionId, html, label) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const versionId = `v${session.versions.length + 1}`;
  const version = { versionId, html, label, createdAt: new Date().toISOString() };
  session.versions.push(version);
  return version;
}

export function getVersions(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.versions.map(({ versionId, label, createdAt }) => ({ versionId, label, createdAt }));
}

export function getAllSessions() {
  return Array.from(sessions.values());
}
