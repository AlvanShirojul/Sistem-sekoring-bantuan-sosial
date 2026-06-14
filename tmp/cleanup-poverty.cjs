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

    const client = await pool.connect();
    try {
      console.log('Connected to DB, running poverty cleanup...');

      const queries = [
        `UPDATE saw_bwm_config
         SET criteria_options = (
           SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
           FROM jsonb_array_elements(criteria_options) AS arr(elem)
           WHERE NOT (
             (elem->>'key') ILIKE '%poverty%' OR
             (elem->>'label') ILIKE '%kemiskinan%' OR
             (elem->>'label') ILIKE '%poverty%'
           )
         )
         WHERE id = 1;`,

        `DELETE FROM saw_criteria WHERE name ILIKE '%poverty%' OR name ILIKE '%kemiskinan%';`,

        `DELETE FROM saw_normalization_matrix m
         USING saw_criteria c
         WHERE m.criterion_id = c.id
           AND (c.name ILIKE '%poverty%' OR c.name ILIKE '%kemiskinan%');`,

        `UPDATE residents
         SET criteria_scores = (
           SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
           FROM jsonb_each(criteria_scores) AS t(k, v)
           WHERE k NOT ILIKE '%poverty%' AND k NOT ILIKE '%kemiskinan%'
         )
         WHERE criteria_scores IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM jsonb_each_text(criteria_scores) AS t(k, v) WHERE k ILIKE '%poverty%' OR k ILIKE '%kemiskinan%'
           );`,
      ];

      for (const q of queries) {
        const res = await client.query(q);
        console.log('Query executed, rowCount:', res.rowCount ?? '(unknown)');
      }

      console.log('Poverty cleanup completed.');
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    console.error('Error during cleanup:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
  }
})();
