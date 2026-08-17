import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { getDatabase } from './db/connection';
import { authRouter } from './routes/auth.routes';
import { sportsRouter } from './routes/sports.routes';
import { careRouter } from './routes/care.routes';
import { adminRouter } from './routes/admin.routes';

export function createServer(): express.Application {
  const app = express();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-MiniApp-Id', 'X-MiniApp-Token'],
  }));

  app.use(express.json());

  // Request logger
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (config.nodeEnv !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  // Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/sports', sportsRouter);
  app.use('/api/care', careRouter);
  app.use('/api/admin', adminRouter);

  // Root status endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'WEVSOCIAL Super-App Backend Engine',
      status: 'ONLINE',
      version: '1.0.0',
      endpoints: [
        '/api/auth/register',
        '/api/auth/login',
        '/api/auth/refresh',
        '/api/sports/activities',
        '/api/sports/bookings',
        '/api/care/providers',
        '/api/care/bookings',
        '/api/admin/host-only',
      ],
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint Not Found', code: 'NOT_FOUND' });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: message, code: 'INTERNAL_ERROR' });
  });

  return app;
}

export async function startServer(): Promise<{ app: express.Application; server: import('http').Server }> {
  await getDatabase();
  const app = createServer();
  const server = app.listen(config.port, () => {
    console.log(`🚀 WEVSOCIAL Backend running on http://localhost:${config.port}`);
  });
  return { app, server };
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
