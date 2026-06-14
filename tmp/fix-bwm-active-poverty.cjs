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

    const res = await pool.query(`SELECT id, active_criteria, best_to_others, others_to_worst FROM saw_bwm_config WHERE id = 1`);
    if (!res.rows || res.rows.length === 0) {
      console.log('No config row found');
      await pool.end();
      return;
    }

    const row = res.rows[0];
    const active = row.active_criteria || [];
    const bestTo = row.best_to_others || {};
    const othersTo = row.others_to_worst || {};

    const filteredActive = (active || []).filter(k => !(String(k || '').toLowerCase().includes('poverty') || String(k || '').toLowerCase().includes('kemiskinan')));

    const filteredBestTo = Object.fromEntries(Object.entries(bestTo || {}).filter(([k]) => !String(k || '').toLowerCase().includes('poverty') && !String(k || '').toLowerCase().includes('kemiskinan')));
    const filteredOthersTo = Object.fromEntries(Object.entries(othersTo || {}).filter(([k]) => !String(k || '').toLowerCase().includes('poverty') && !String(k || '').toLowerCase().includes('kemiskinan')));

    const update = await pool.query(`UPDATE saw_bwm_config SET active_criteria = $1::jsonb, best_to_others = $2::jsonb, others_to_worst = $3::jsonb WHERE id = 1 RETURNING id`, [JSON.stringify(filteredActive), JSON.stringify(filteredBestTo), JSON.stringify(filteredOthersTo)]);
    console.log('Updated rows:', update.rowCount);

    await pool.end();
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
  }
})();
