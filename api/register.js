import { registerUser } from './_lib/authService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  try {
    const user = await registerUser(username, password);
    return res.status(201).json(user);
  } catch (error) {
    const msg = error && error.message;
    if (msg && msg.includes('exists')) {
      return res.status(409).json({ error: msg });
    }
    return res.status(400).json({ error: msg || 'Registration failed' });
  }
}
