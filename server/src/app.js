import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { loadUser } from './auth.js';
import { WEB_DIST } from './config.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import orderRoutes, { publicRoutes } from './routes/orders.js';
import driverRoutes from './routes/driver.js';
import adminRoutes from './routes/admin.js';

// Records every API call (who, what, result, timing) for the CRM's API activity view.
function apiLogger(db) {
  const insert = db.prepare('INSERT INTO api_logs (user_id, role, method, path, status, duration_ms, ip) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let writes = 0;
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path === '/health') return;
      insert.run(req.user?.id ?? null, req.user?.role ?? null, req.method, req.originalUrl.split('?')[0].slice(0, 300), res.statusCode, Date.now() - start, req.ip);
      if (++writes % 1000 === 0) db.exec("DELETE FROM api_logs WHERE created_at < datetime('now', '-30 days')");
    });
    next();
  };
}

export function createApp(db, { serveWeb = true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  // Session cookies are SameSite=Lax; also reject cross-site JSON writes outright.
  app.use('/api', (req, res, next) => {
    const hasBody = Number(req.headers['content-length'] || 0) > 0;
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && hasBody && !req.is('application/json')) {
      return res.status(415).json({ error: 'Send JSON' });
    }
    next();
  });

  app.use(loadUser(db));
  app.use('/api', apiLogger(db));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(db));
  app.use('/api/account', accountRoutes(db));
  app.use('/api', publicRoutes(db));
  app.use('/api/orders', orderRoutes(db));
  app.use('/api/driver', driverRoutes(db));
  app.use('/api/admin', adminRoutes(db));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (serveWeb && fs.existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }

  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on our end' : err.message });
  });

  return app;
}
