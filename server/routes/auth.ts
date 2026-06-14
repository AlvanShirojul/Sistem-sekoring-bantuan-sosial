import { Router, Request, Response } from 'express';
import { registerUser, loginUser, verifyToken, getAllUsers } from '../services/authService';

const router = Router();

/**
 * POST /api/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await registerUser(username, password);
    res.status(201).json(user);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/login
 * Authenticate user and get JWT token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const result = await loginUser(username, password);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/check-auth
 * Check authentication status
 */
router.get('/check-auth', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    const result = verifyToken(token);
    res.status(result.isAuthenticated ? 200 : 401).json(result);
  } else {
    res.status(401).json({ isAuthenticated: false, error: 'No token provided' });
  }
});

/**
 * POST /api/logout
 * Logout endpoint (JWT is stateless)
 */
router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/debug/users
 * Debug endpoint - check users in database
 */
router.get('/debug/users', async (req: Request, res: Response) => {
  try {
    const result = await getAllUsers();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
