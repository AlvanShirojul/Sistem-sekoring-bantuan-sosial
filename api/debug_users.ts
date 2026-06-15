import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllUsers } from '../server/services/authService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await getAllUsers();
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
