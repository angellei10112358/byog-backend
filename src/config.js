import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { cwd } from 'node:process';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  apiKey: process.env.API_KEY || null,
  opencodeModel: process.env.OPENCODE_MODEL || 'deepseek/deepseek-chat',
  opencodeTimeout: parseInt(process.env.OPENCODE_TIMEOUT_MS || '900000', 10),
  workspacesRoot: resolve(process.env.WORKSPACES_ROOT || resolve(cwd(), 'workspaces')),
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '20', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  },
};

mkdirSync(config.workspacesRoot, { recursive: true });
