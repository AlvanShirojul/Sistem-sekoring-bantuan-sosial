import { getAllUsers } from './_lib/authService.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await getAllUsers();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: (error && error.message) || 'Internal error' });
  }
}
