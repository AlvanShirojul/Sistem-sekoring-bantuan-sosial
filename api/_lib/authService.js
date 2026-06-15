import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { JWT_SECRET } from '../../server/utils/constants.js';

export async function registerUser(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters long');

  const hashed = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashed]
    );
    return { id: result.rows[0].id, username };
  } catch (err) {
    // Postgres unique violation code
    if (err && err.code === '23505') {
      throw new Error('Username already exists');
    }
    throw err;
  }
}

export async function loginUser(username, password) {
  if (!username || !password) throw new Error('Username and password are required');

  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user) throw new Error('Invalid credentials');
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid credentials');

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  return { token };
}

export function verifyToken(token) {
  try {
    const user = jwt.verify(token, JWT_SECRET);
    return { isAuthenticated: true, user };
  } catch (err) {
    return { isAuthenticated: false, error: 'Invalid token' };
  }
}

export async function getAllUsers() {
  const result = await pool.query('SELECT id, username, created_at FROM users ORDER BY id DESC');
  return { total: result.rows.length, users: result.rows };
}

export default { registerUser, loginUser, verifyToken, getAllUsers };
