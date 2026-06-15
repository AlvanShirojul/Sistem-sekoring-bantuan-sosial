import { verifyToken } from './_lib/authService.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader) {
    return res.status(401).json({ isAuthenticated: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const result = verifyToken(token);
  return res.status(result.isAuthenticated ? 200 : 401).json(result);
}
