import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { conditionalAuth } from './middleware/auth';
import apiRoutes from './routes';
import { PUBLIC_ROUTES, UPLOAD_SIZE_LIMIT } from './utils/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create and configure Express app
 */
export async function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: UPLOAD_SIZE_LIMIT }));
  app.use(express.urlencoded({ limit: UPLOAD_SIZE_LIMIT, extended: true }));

  // Conditional authentication middleware
  app.use('/api', conditionalAuth(PUBLIC_ROUTES.map(route => route.replace('/api', ''))));

  // API routes
  app.use('/api', apiRoutes);

  // Vite development server or static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
