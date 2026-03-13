import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { sessionMiddleware } from './lib/session.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import repRoutes from './routes/reps.js';
import queueRoutes from './routes/queue.js';
import analyticsRoutes from './routes/analytics.js';
import inviteRoutes from './routes/invites.js';
import settingsRoutes from './routes/settings.js';
import campaignRoutes from './routes/campaigns.js';
import ogRoutes from './routes/og.js';
import { startScheduler } from './jobs/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// View engine for OG pages
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for OG pages
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: config.isDev ? 'http://localhost:5173' : false, credentials: true }));
app.use(morgan(config.isDev ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Serve uploaded images (public, no auth)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// OG pages (server-rendered, must come before SPA catch-all)
app.use('/og', ogRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reps', repRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/campaigns', campaignRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React build in production
if (!config.isDev) {
  const clientDist = path.join(process.cwd(), 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Leegality Advocate running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  startScheduler();
});

export default app;
