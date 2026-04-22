import express, { Application } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { prisma } from './config/db';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './modules/auth/auth.routes';
import medicationRoutes from './modules/medications/medications.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes from './modules/roles/roles.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import locationsRoutes from './modules/locations/locations.routes';

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    })
  );
  app.use(express.json());

  // Liveness: process is up and can serve requests.
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'drug-info-server',
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  // Readiness: dependencies are reachable and app is ready for traffic.
  app.get('/api/health/readiness', async (_req, res) => {
    const startedAt = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - startedAt;

      res.json({
        status: 'ok',
        service: 'drug-info-server',
        checks: {
          database: {
            status: 'ok',
            latencyMs,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;

      res.status(503).json({
        status: 'error',
        service: 'drug-info-server',
        checks: {
          database: {
            status: 'error',
            latencyMs,
            message: 'Database connectivity failed',
          },
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.use('/api/auth', authRoutes);

  app.use('/api/medications', medicationRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/locations', locationsRoutes);
  app.use('/api/analytics', analyticsRoutes);

  app.use(errorHandler);

  return app;
}
