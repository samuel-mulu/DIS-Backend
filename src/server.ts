import { createApp } from './app';
import { config } from './config/env';
import { connectDB, disconnectDB } from './config/db';

async function startServer() {
  await connectDB();
  
  const app = createApp();
  const PORT = config.port;

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });

  const gracefulShutdown = async () => {
    console.log('Shutting down server...');
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
