import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../database';
import { JWT_SECRET } from '../utils/constants';

/**
 * Register a new user
 */
export async function registerUser(username: string, password: string) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    const newUser = result.rows[0];
    return { id: newUser.id, username };
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('Username already exists');
    }
    throw error;
  }
}

/**
 * Authenticate user and generate JWT token
 */
export async function loginUser(username: string, password: string) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return { token };
  } catch (error) {
    throw error;
  }
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string) {
  try {
    const user = jwt.verify(token, JWT_SECRET);
    return { isAuthenticated: true, user };
  } catch (err) {
    return { isAuthenticated: false, error: 'Invalid token' };
  }
}

/**
 * Get all users (for debugging)
 */
export async function getAllUsers() {
  try {
    const result = await pool.query('SELECT id, username, created_at FROM users ORDER BY id DESC');
    return {
      total: result.rows.length,
      users: result.rows
    };
  } catch (error) {
    throw error;
  }
}
