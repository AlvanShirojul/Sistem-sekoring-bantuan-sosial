import { Pool } from 'pg';
import dotenv from 'dotenv';
import { createDefaultBwmInput, getSawCriteriaKeys, getSawDefaultCriteriaOptions, calculateBwmWeights } from '../shared/metodeSAW';

dotenv.config();

/**
 * PostgreSQL Connection Pool
 */
export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Initialize database tables
 */
export async function initializeDatabase() {
  try {
    // Create periods table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS periods (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        quota INTEGER,
        criteria_options JSONB,
        active_criteria JSONB,
        best_criterion TEXT,
        worst_criterion TEXT,
        best_to_others JSONB,
        others_to_worst JSONB,
        weights JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create residents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS residents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        nik TEXT UNIQUE,
        family_card_no TEXT,
        address TEXT,
        rt TEXT,
        rw TEXT,
        dusun TEXT,
        desa TEXT,
        kecamatan TEXT,
        kabupaten TEXT,
        birth_place TEXT,
        birth_date TEXT,
        gender TEXT,
        marital_status TEXT,
        occupation TEXT,
        phone_number TEXT,
        email TEXT,
        monthly_income DECIMAL,
        poverty_level TEXT,
        house_conditions TEXT,
        education TEXT,
        criteria_scores JSONB DEFAULT '{}'::jsonb,
        family_size INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create SAW final calculation table (latest snapshot)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saw_calculation_results (
        id SERIAL PRIMARY KEY,
        resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        is_complete BOOLEAN NOT NULL DEFAULT FALSE,
        score DECIMAL,
        status TEXT NOT NULL,
        rank INTEGER,
        raw_income DECIMAL,
        raw_poverty DECIMAL,
        raw_house DECIMAL,
        raw_family DECIMAL,
        normalized_income DECIMAL,
        normalized_poverty DECIMAL,
        normalized_house DECIMAL,
        normalized_family DECIMAL,
        weighted_income DECIMAL,
        weighted_poverty DECIMAL,
        weighted_house DECIMAL,
        weighted_family DECIMAL,
        total_weighted_score DECIMAL,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(resident_id)
      );
    `);

    // Create SAW criteria master table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saw_criteria (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        criterion_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create SAW normalization matrix table for documentation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saw_normalization_matrix (
        id SERIAL PRIMARY KEY,
        resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        criterion_id INTEGER NOT NULL REFERENCES saw_criteria(id) ON DELETE CASCADE,
        raw_value DECIMAL,
        reference_min DECIMAL,
        reference_max DECIMAL,
        normalized_value DECIMAL,
        weight DECIMAL,
        weighted_value DECIMAL,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(resident_id, criterion_id)
      );
    `);

    // Create SAW calculation history tables (snapshot before BWM changes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saw_calculation_history_runs (
        id SERIAL PRIMARY KEY,
        reason TEXT NOT NULL,
        config_snapshot JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saw_calculation_history_results (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES saw_calculation_history_runs(id) ON DELETE CASCADE,
        resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        is_complete BOOLEAN NOT NULL DEFAULT FALSE,
        score DECIMAL,
        status TEXT NOT NULL,
        rank INTEGER,
        total_weighted_score DECIMAL
      );
    `);

    // Create SAW-BWM configuration table (single-row config)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saw_bwm_config (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        criteria_options JSONB NOT NULL,
        active_criteria JSONB NOT NULL,
        best_criterion TEXT NOT NULL,
        worst_criterion TEXT NOT NULL,
        best_to_others JSONB NOT NULL,
        others_to_worst JSONB NOT NULL,
        weights JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const defaultCriteria = getSawCriteriaKeys();
    const defaultBwm = createDefaultBwmInput(defaultCriteria);
    const defaultCriteriaOptions = getSawDefaultCriteriaOptions();
    let defaultWeights: Record<string, number> = {};
    try {
      defaultWeights = calculateBwmWeights(defaultBwm, defaultBwm.criteria);
    } catch (e) {
      defaultWeights = {};
    }

    // Backward-compatible migration for criteria_scores and BWM criteria_options.
    await pool.query(`
      ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS criteria_scores JSONB DEFAULT '{}'::jsonb;
    `);
    await pool.query(`
      ALTER TABLE saw_bwm_config
      ADD COLUMN IF NOT EXISTS criteria_options JSONB;
    `);
    await pool.query(
      `UPDATE saw_bwm_config
       SET criteria_options = $1::jsonb
       WHERE criteria_options IS NULL`,
      [JSON.stringify(defaultCriteriaOptions)]
    );
    await pool.query(`
      ALTER TABLE saw_bwm_config
      ALTER COLUMN criteria_options SET NOT NULL;
    `);

    // Seed default BWM config if empty.
    await pool.query(
      `INSERT INTO saw_bwm_config (
        id, criteria_options, active_criteria, best_criterion, worst_criterion, best_to_others, others_to_worst
      ) VALUES (1, $1::jsonb, $2::jsonb, $3, $4, $5::jsonb, $6::jsonb)
      ON CONFLICT (id) DO NOTHING`,
      [
        JSON.stringify(defaultCriteriaOptions),
        JSON.stringify(defaultBwm.criteria),
        defaultBwm.bestCriterion,
        defaultBwm.worstCriterion,
        JSON.stringify(defaultBwm.bestToOthers),
        JSON.stringify(defaultBwm.othersToWorst),
      ]
    );

    // Ensure weights column exists and seed weights for existing row if empty
    await pool.query(`ALTER TABLE saw_bwm_config ADD COLUMN IF NOT EXISTS weights JSONB;`);
    await pool.query(
      `UPDATE saw_bwm_config SET weights = $1::jsonb WHERE weights IS NULL`,
      [JSON.stringify(defaultWeights)]
    );

    // Create beneficiaries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS beneficiaries (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        resident_id INTEGER NOT NULL REFERENCES residents(id),
        score DECIMAL,
        status TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(period_id, resident_id)
      );
    `);

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

    // Performance indexes for frequent dashboard reads
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_residents_name
      ON residents (name);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saw_calculation_results_resident_id
      ON saw_calculation_results (resident_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saw_calculation_results_score
      ON saw_calculation_results (score DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_period_score
      ON beneficiaries (period_id, score DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_resident_id
      ON beneficiaries (resident_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saw_history_runs_created_at
      ON saw_calculation_history_runs (created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saw_history_results_run_id
      ON saw_calculation_history_results (run_id);
    `);

    // Add quota column to periods if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE periods
        ADD COLUMN IF NOT EXISTS quota INTEGER,
        ADD COLUMN IF NOT EXISTS criteria_options JSONB,
        ADD COLUMN IF NOT EXISTS active_criteria JSONB,
        ADD COLUMN IF NOT EXISTS best_criterion TEXT,
        ADD COLUMN IF NOT EXISTS worst_criterion TEXT,
        ADD COLUMN IF NOT EXISTS best_to_others JSONB,
        ADD COLUMN IF NOT EXISTS others_to_worst JSONB,
        ADD COLUMN IF NOT EXISTS weights JSONB;
      `);
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.warn('Warning: Could not add quota column to periods:', error.message);
      }
    }

    // Ensure score columns use decimal scale (0.00 - 1.00)
    async function ensureDecimalColumn(
      tableName: string,
      columnName: string
    ) {
      const typeCheck = await pool.query(
        `SELECT data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
         LIMIT 1`,
        [tableName, columnName]
      );

      const dataType = typeCheck.rows[0]?.data_type;
      if (!dataType || dataType === 'numeric' || dataType === 'decimal') {
        return;
      }

      // Temporarily disable statement timeout for this migration step only.
      await pool.query(`SET statement_timeout = 0`);
      try {
        await pool.query(
          `ALTER TABLE ${tableName}
           ALTER COLUMN ${columnName} TYPE DECIMAL USING ${columnName}::DECIMAL`
        );
      } finally {
        await pool.query(`RESET statement_timeout`);
      }
    }

    try {
      await ensureDecimalColumn('beneficiaries', 'score');
    } catch (error: any) {
      console.warn('Warning: Could not alter beneficiaries.score to DECIMAL:', error.message);
    }

    try {
      await ensureDecimalColumn('saw_calculation_results', 'score');
    } catch (error: any) {
      console.warn('Warning: Could not alter saw_calculation_results.score to DECIMAL:', error.message);
    }

    // Backward-compatible migration for old SAW matrix schema using criterion_name/criterion_type
    try {
      await pool.query(`
        ALTER TABLE saw_normalization_matrix
        ADD COLUMN IF NOT EXISTS criterion_id INTEGER;
      `);

      await pool.query(`
        INSERT INTO saw_criteria (name, criterion_type)
        SELECT DISTINCT criterion_name, criterion_type
        FROM saw_normalization_matrix
        WHERE criterion_name IS NOT NULL
        ON CONFLICT (name) DO UPDATE SET
          criterion_type = EXCLUDED.criterion_type;
      `);

      await pool.query(`
        UPDATE saw_normalization_matrix m
        SET criterion_id = c.id
        FROM saw_criteria c
        WHERE m.criterion_id IS NULL
          AND m.criterion_name = c.name;
      `);

      await pool.query(`
        DELETE FROM saw_normalization_matrix a
        USING saw_normalization_matrix b
        WHERE a.id < b.id
          AND a.resident_id = b.resident_id
          AND a.criterion_id = b.criterion_id
          AND a.criterion_id IS NOT NULL;
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_saw_normalization_matrix_resident_criterion
        ON saw_normalization_matrix (resident_id, criterion_id);
      `);

      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'saw_normalization_matrix_criterion_id_fkey'
          ) THEN
            ALTER TABLE saw_normalization_matrix
            ADD CONSTRAINT saw_normalization_matrix_criterion_id_fkey
            FOREIGN KEY (criterion_id) REFERENCES saw_criteria(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);

      await pool.query(`
        ALTER TABLE saw_normalization_matrix
        ALTER COLUMN criterion_id SET NOT NULL;
      `);

      await pool.query(`
        ALTER TABLE saw_normalization_matrix
        DROP COLUMN IF EXISTS criterion_name,
        DROP COLUMN IF EXISTS criterion_type;
      `);
    } catch (error: any) {
      console.warn('Warning: Could not migrate saw_normalization_matrix schema:', error.message);
    }

    // Backward-compatible migration for older residents table schemas
    try {
      await pool.query(`
        ALTER TABLE residents
        ADD COLUMN IF NOT EXISTS family_card_no TEXT,
        ADD COLUMN IF NOT EXISTS rt TEXT,
        ADD COLUMN IF NOT EXISTS rw TEXT,
        ADD COLUMN IF NOT EXISTS dusun TEXT,
        ADD COLUMN IF NOT EXISTS desa TEXT,
        ADD COLUMN IF NOT EXISTS kecamatan TEXT,
        ADD COLUMN IF NOT EXISTS kabupaten TEXT,
        ADD COLUMN IF NOT EXISTS birth_place TEXT,
        ADD COLUMN IF NOT EXISTS birth_date TEXT,
        ADD COLUMN IF NOT EXISTS gender TEXT,
        ADD COLUMN IF NOT EXISTS marital_status TEXT,
        ADD COLUMN IF NOT EXISTS occupation TEXT,
        ADD COLUMN IF NOT EXISTS phone_number TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS monthly_income DECIMAL,
        ADD COLUMN IF NOT EXISTS poverty_level TEXT,
        ADD COLUMN IF NOT EXISTS house_conditions TEXT,
        ADD COLUMN IF NOT EXISTS education TEXT,
        ADD COLUMN IF NOT EXISTS family_size INTEGER;
      `);
    } catch (error: any) {
      console.warn('Warning: Could not migrate residents columns:', error.message);
    }

    // Drop legacy SAW columns from residents (moved to dedicated SAW tables)
    try {
      await pool.query(`
        ALTER TABLE residents
        DROP COLUMN IF EXISTS saw_score,
        DROP COLUMN IF EXISTS saw_status,
        DROP COLUMN IF EXISTS saw_rank;
      `);
    } catch (error: any) {
      console.warn('Warning: Could not drop legacy SAW columns from residents:', error.message);
    }

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}
