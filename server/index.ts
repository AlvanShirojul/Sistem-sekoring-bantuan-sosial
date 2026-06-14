import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import { createApp } from './app';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize database
    console.log('🗄️  Initializing database...');
    await initializeDatabase();

    // Create Express app
    console.log('🚀 Creating Express app...');
    const app = await createApp();

    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
