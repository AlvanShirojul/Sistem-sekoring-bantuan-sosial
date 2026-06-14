const fs = require('fs');
const { Pool } = require('pg');
function parseDotEnv(path) {
  const src = fs.readFileSync(path, 'utf8');
  const out = {};
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
(async () => {
  try {
    const env = parseDotEnv('.env');
    const pool = new Pool({
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 5432),
      database: env.DB_NAME || 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    const res = await pool.query(`SELECT id, criteria_options, active_criteria, best_criterion, worst_criterion, best_to_others, others_to_worst FROM saw_bwm_config WHERE id = 1`);
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
  }
})();
