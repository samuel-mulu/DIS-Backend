import express, { Application } from 'express';
import cors from 'cors';
import { config } from './config/env';
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

  // Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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
