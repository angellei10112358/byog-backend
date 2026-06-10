import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import sessionsRouter from './routes/sessions.js';
import messagesRouter from './routes/messages.js';
import versionsRouter from './routes/versions.js';
import healthRouter from './routes/health.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit);

app.use('/api', healthRouter);
app.use('/api/sessions', requireAuth, sessionsRouter);
app.use('/api/sessions', requireAuth, messagesRouter);
app.use('/api/sessions', requireAuth, versionsRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`BYOG backend listening on http://0.0.0.0:${config.port}`);
  console.log(`Workspaces root: ${config.workspacesRoot}`);
  console.log(`CORS origin: ${config.corsOrigin}`);
  console.log(`Model: ${config.opencodeModel}`);
});
