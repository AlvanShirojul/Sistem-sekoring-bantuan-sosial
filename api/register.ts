import type { VercelRequest, VercelResponse } from '@vercel/node';
import { registerUser } from '../server/services/authService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  try {
    const user = await registerUser(username, password);
    return res.status(201).json(user);
  } catch (error: any) {
    if (error.message.includes('already exists') || error.message.includes('Username already exists')) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Registration failed' });
  }
}
