import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Berhasil terhubung ke database!');
    const res = await client.query('SELECT NOW()');
    console.log('Waktu server:', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Gagal terhubung ke database:', err);
  } finally {
    await pool.end();
  }
})();