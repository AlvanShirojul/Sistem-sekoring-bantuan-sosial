import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loginUser } from '../server/services/authService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  try {
    const result = await loginUser(username, password);
    return res.json(result);
  } catch (error: any) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Login failed' });
  }
}
