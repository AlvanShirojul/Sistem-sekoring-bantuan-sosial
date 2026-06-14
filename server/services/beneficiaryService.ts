import { pool } from '../database';
import { VALID_BENEFICIARY_STATUS, DEFAULT_BENEFICIARY_SCORE, DEFAULT_BENEFICIARY_STATUS } from '../utils/constants';
import {
  buildSawBwmConfig,
  calculateMetodeSAWDetailed,
  getSawDefaultCriteriaOptions,
  sanitizeActiveCriteria,
  type SawCriteriaOption,
  type BwmInput,
} from '../../shared/metodeSAW';

interface SawBwmConfigResponse {
  activeCriteria: string[];
  criteriaOptions: SawCriteriaOption[];
  bestCriterion: string;
  worstCriterion: string;
  bestToOthers: Partial<Record<string, number>>;
  othersToWorst: Partial<Record<string, number>>;
  weights: Record<string, number>;
}

interface SawHistoryRunSummary {
  run_id: number;
  reason: string;
  created_at: string;
  resident_count: number;
}

function parseJsonColumn<T>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeCriteriaOptions(input: unknown): SawCriteriaOption[] {
  const defaults = getSawDefaultCriteriaOptions();
  const byKey = new Map(defaults.map((item) => [item.key, item]));

  if (Array.isArray(input)) {
    for (const row of input) {
      const key = String((row as any)?.key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!key) continue;

      const fallback = byKey.get(key);
      byKey.set(key, {
        key,
        label: String((row as any)?.label || fallback?.label || key),
        type: 'benefit',
        source: fallback?.source || 'custom',
      });
    }
  }

  // Remove any criteria that explicitly reference "penyakit" (case-insensitive)
  // to avoid showing a deprecated/undesired criterion in the UI.
  const filtered = Array.from(byKey.values()).filter((item) => {
    const key = String(item.key || '').toLowerCase();
    const label = String(item.label || '').toLowerCase();
    // Remove deprecated/undesired criteria
    if (key === 'penyakit' || key.includes('penyakit')) return false;
    if (label.includes('penyakit')) return false;
    // Remove poverty/tingkat kemiskinan if present
    if (key === 'poverty' || key.includes('poverty')) return false;
    if (label.includes('kemiskinan') || label.includes('poverty')) return false;
    return true;
  });

  return filtered;
}

function buildBwmConfigResponse(
  criteriaOptionsInput?: unknown,
  activeCriteriaInput?: string[],
  bwmInput?: Partial<BwmInput>
): SawBwmConfigResponse {
  const criteriaOptions = sanitizeCriteriaOptions(criteriaOptionsInput);
  const allowedKeys = criteriaOptions.map((item) => item.key);
  const activeCriteria = sanitizeActiveCriteria(activeCriteriaInput || allowedKeys).filter((key) =>
    allowedKeys.includes(key)
  );

  const resolved = buildSawBwmConfig(activeCriteria, {
    ...bwmInput,
    criteria: activeCriteria,
  });

  return {
    activeCriteria: resolved.activeCriteria,
    criteriaOptions,
    bestCriterion: resolved.bwmInput.bestCriterion,
    worstCriterion: resolved.bwmInput.worstCriterion,
    bestToOthers: resolved.bwmInput.bestToOthers,
    othersToWorst: resolved.bwmInput.othersToWorst,
    weights: resolved.weights,
  };
}

function resolveBwmPayload(payload: any): {
  criteriaOptions: SawCriteriaOption[];
  resolved: SawBwmConfigResponse;
} {
  const criteriaOptions = sanitizeCriteriaOptions(payload?.criteriaOptions);
  const allowedKeys = criteriaOptions.map((item) => item.key);
  const rawActiveCriteria = Array.isArray(payload?.activeCriteria)
    ? payload.activeCriteria.filter((key: string) => allowedKeys.includes(key))
    : undefined;

  if (rawActiveCriteria && rawActiveCriteria.length < 2) {
    throw new Error('Minimal pilih 2 kriteria aktif.');
  }

  const resolved = buildBwmConfigResponse(criteriaOptions, rawActiveCriteria, {
    criteria: rawActiveCriteria,
    bestCriterion: payload?.bestCriterion,
    worstCriterion: payload?.worstCriterion,
    bestToOthers: payload?.bestToOthers,
    othersToWorst: payload?.othersToWorst,
  });

  return { criteriaOptions, resolved };
}

async function snapshotSawCalculationResults(reason = 'before_bwm_update') {
  const result = await pool.query(
    `SELECT resident_id, is_complete, score, status, rank, total_weighted_score
     FROM saw_calculation_results`
  );

  if (result.rows.length === 0) {
    return null;
  }

  const configSnapshot = await getRawSawBwmConfig();
  const runResult = await pool.query(
    `INSERT INTO saw_calculation_history_runs (reason, config_snapshot, created_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     RETURNING id`,
    [reason, JSON.stringify(configSnapshot)]
  );

  const runId = runResult.rows[0].id;
  const placeholders: string[] = [];
  const values: Array<number | string | boolean | null> = [];
  let param = 1;

  for (const row of result.rows) {
    placeholders.push(
      `($${param}, $${param + 1}, $${param + 2}, $${param + 3}, $${param + 4}, $${param + 5}, $${param + 6})`
    );
    values.push(
      runId,
      row.resident_id,
      row.is_complete,
      row.score ?? null,
      row.status,
      row.rank ?? null,
      row.total_weighted_score ?? null
    );
    param += 7;
  }

  await pool.query(
    `INSERT INTO saw_calculation_history_results (
      run_id, resident_id, is_complete, score, status, rank, total_weighted_score
    ) VALUES ${placeholders.join(', ')}`,
    values
  );

  return runId;
}

async function ensureResidentCriteriaScoreKeys(criteriaKeys: string[]) {
  const normalizedKeys = Array.from(
    new Set(
      criteriaKeys
        .map((key) => String(key || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (normalizedKeys.length === 0) {
    return;
  }

  const defaults = normalizedKeys.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as Record<string, null>);

  await pool.query(
    `UPDATE residents
     SET criteria_scores = ($1::jsonb || COALESCE(criteria_scores, '{}'::jsonb))
     WHERE COALESCE(criteria_scores, '{}'::jsonb) <> ($1::jsonb || COALESCE(criteria_scores, '{}'::jsonb))`,
    [JSON.stringify(defaults)]
  );
}

export async function getSawBwmConfig(): Promise<SawBwmConfigResponse> {
  // Return a client-friendly view (no sub-criteria shown, parent weights aggregated)
  const raw = await getRawSawBwmConfig();
  return transformConfigForClient(raw);
}

/**
 * Internal: return raw (full) BWM config used by backend routines.
 * This preserves sub-criteria entries (e.g. 'house.permanen').
 */
export async function getRawSawBwmConfig(): Promise<SawBwmConfigResponse> {
  const result = await pool.query(
    `SELECT criteria_options, active_criteria, best_criterion, worst_criterion, best_to_others, others_to_worst
     FROM saw_bwm_config
     WHERE id = 1
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    return buildBwmConfigResponse();
  }

  const row = result.rows[0];
  const criteriaOptions = parseJsonColumn<SawCriteriaOption[]>(row.criteria_options, []);
  const activeCriteria = parseJsonColumn<string[]>(row.active_criteria, []);
  return buildBwmConfigResponse(
    criteriaOptions,
    activeCriteria,
    {
      criteria: activeCriteria,
      bestCriterion: row.best_criterion,
      worstCriterion: row.worst_criterion,
      bestToOthers: parseJsonColumn<Partial<Record<string, number>>>(row.best_to_others, {}),
      othersToWorst: parseJsonColumn<Partial<Record<string, number>>>(row.others_to_worst, {}),
    }
  );
}

function getParentKey(key: string) {
  return String(key || '').split('.')[0];
}

function transformConfigForClient(resolved: SawBwmConfigResponse) {
  // criteriaOptions: only top-level (no dot) entries
  const parentOptions = resolved.criteriaOptions.filter((item) => !String(item.key).includes('.'));

  // activeCriteria: map any expanded child to its parent and dedupe
  const activeParents = Array.from(new Set(resolved.activeCriteria.map(getParentKey)));

  // weights: sum weights for children into parent key
  const parentWeights: Record<string, number> = {};
  for (const [key, w] of Object.entries(resolved.weights || {})) {
    const parent = getParentKey(key);
    parentWeights[parent] = (parentWeights[parent] || 0) + (Number(w) || 0);
  }

  // map best/worst to parent keys
  const bestParent = getParentKey(resolved.bestCriterion);
  const worstParent = getParentKey(resolved.worstCriterion);

  return {
    activeCriteria: activeParents,
    criteriaOptions: parentOptions,
    bestCriterion: bestParent,
    worstCriterion: worstParent,
    bestToOthers: resolved.bestToOthers,
    othersToWorst: resolved.othersToWorst,
    weights: parentWeights,
  } as SawBwmConfigResponse;
}

export async function previewSawBwmConfig(payload: any): Promise<SawBwmConfigResponse> {
  const { resolved } = resolveBwmPayload(payload || {});
  return transformConfigForClient(resolved);
}

export async function saveSawBwmConfig(payload: any): Promise<SawBwmConfigResponse> {
  const { criteriaOptions, resolved } = resolveBwmPayload(payload || {});

  await snapshotSawCalculationResults('before_bwm_update');

  await pool.query(
    `INSERT INTO saw_bwm_config (
      id, criteria_options, active_criteria, best_criterion, worst_criterion, best_to_others, others_to_worst, updated_at
    ) VALUES (1, $1::jsonb, $2::jsonb, $3, $4, $5::jsonb, $6::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      criteria_options = EXCLUDED.criteria_options,
      active_criteria = EXCLUDED.active_criteria,
      best_criterion = EXCLUDED.best_criterion,
      worst_criterion = EXCLUDED.worst_criterion,
      best_to_others = EXCLUDED.best_to_others,
      others_to_worst = EXCLUDED.others_to_worst,
      updated_at = CURRENT_TIMESTAMP`,
    [
      JSON.stringify(criteriaOptions),
      JSON.stringify(resolved.activeCriteria),
      resolved.bestCriterion,
      resolved.worstCriterion,
      JSON.stringify(resolved.bestToOthers),
      JSON.stringify(resolved.othersToWorst),
    ]
  );

  // Keep residents.criteria_scores aligned with the latest criteria master.
  await ensureResidentCriteriaScoreKeys(criteriaOptions.map((item) => item.key));
  await syncAllBeneficiaryScores();
  return getSawBwmConfig();
}

export async function getSawCalculationHistory(limit = 10): Promise<SawHistoryRunSummary[]> {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(100, Math.max(1, Number(limit))) : 10;
  const result = await pool.query(
    `SELECT
       r.id AS run_id,
       r.reason,
       r.created_at,
       COUNT(h.id)::INT AS resident_count
     FROM saw_calculation_history_runs r
     LEFT JOIN saw_calculation_history_results h ON h.run_id = r.id
     GROUP BY r.id, r.reason, r.created_at
     ORDER BY r.created_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows;
}

/**
 * Recalculate all beneficiary scores/status using pure SAW across all residents.
 */
export async function syncAllBeneficiaryScores() {
  const bwmConfig = await getRawSawBwmConfig();
  const residentsResult = await pool.query(
    `SELECT id, monthly_income, occupation, poverty_level, house_conditions, family_size, criteria_scores
     FROM residents`
  );
  // include occupation in resident data for employment scoring
  residentsResult.rows.forEach((r: any) => {
    if (r.occupation === undefined) r.occupation = r.job || r.status_pekerjaan || null;
  });

  const sawResults = calculateMetodeSAWDetailed(residentsResult.rows, {
    incompleteStatus: DEFAULT_BENEFICIARY_STATUS,
    activeCriteria: bwmConfig.activeCriteria,
    bwmInput: {
      criteria: bwmConfig.activeCriteria,
      bestCriterion: bwmConfig.bestCriterion,
      worstCriterion: bwmConfig.worstCriterion,
      bestToOthers: bwmConfig.bestToOthers,
      othersToWorst: bwmConfig.othersToWorst,
    },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize sync execution across concurrent requests to avoid race-condition
    // writes on unique keys in SAW tables.
    await client.query('SELECT pg_advisory_xact_lock($1)', [982451653]);

    // Remove orphaned rows only (much cheaper than full-table refresh).
    await client.query(
      `DELETE FROM saw_normalization_matrix m
       WHERE NOT EXISTS (
         SELECT 1 FROM residents r WHERE r.id = m.resident_id
       )`
    );
    await client.query(
      `DELETE FROM saw_calculation_results s
       WHERE NOT EXISTS (
         SELECT 1 FROM residents r WHERE r.id = s.resident_id
       )`
    );

    for (const scoring of sawResults) {
      if (scoring.id === undefined || scoring.id === null) continue;

      await client.query(
        `INSERT INTO saw_calculation_results (
          resident_id, is_complete, score, status, rank,
          raw_income, raw_poverty, raw_house, raw_family,
          normalized_income, normalized_poverty, normalized_house, normalized_family,
          weighted_income, weighted_poverty, weighted_house, weighted_family,
          total_weighted_score, calculated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, CURRENT_TIMESTAMP
        )
        ON CONFLICT (resident_id) DO UPDATE SET
          is_complete = EXCLUDED.is_complete,
          score = EXCLUDED.score,
          status = EXCLUDED.status,
          rank = EXCLUDED.rank,
          raw_income = EXCLUDED.raw_income,
          raw_poverty = EXCLUDED.raw_poverty,
          raw_house = EXCLUDED.raw_house,
          raw_family = EXCLUDED.raw_family,
          normalized_income = EXCLUDED.normalized_income,
          normalized_poverty = EXCLUDED.normalized_poverty,
          normalized_house = EXCLUDED.normalized_house,
          normalized_family = EXCLUDED.normalized_family,
          weighted_income = EXCLUDED.weighted_income,
          weighted_poverty = EXCLUDED.weighted_poverty,
          weighted_house = EXCLUDED.weighted_house,
          weighted_family = EXCLUDED.weighted_family,
          total_weighted_score = EXCLUDED.total_weighted_score,
          calculated_at = CURRENT_TIMESTAMP`,
        [
          scoring.id,
          scoring.isComplete,
          scoring.score,
          scoring.status,
          scoring.rank,
          scoring.raw_income,
          scoring.raw_employment,
          scoring.raw_house,
          scoring.raw_family,
          scoring.normalized_income,
          scoring.normalized_employment,
          scoring.normalized_house,
          scoring.normalized_family,
          scoring.weighted_income,
          scoring.weighted_employment,
          scoring.weighted_house,
          scoring.weighted_family,
          scoring.total_weighted_score,
        ]
      );

      const scoreByKey = {
        income: {
          raw: scoring.raw_income,
          refMin: scoring.min_income,
          refMax: scoring.max_income,
          normalized: scoring.normalized_income,
          weighted: scoring.weighted_income,
        },
        employment: {
          raw: scoring.raw_employment,
          refMin: null,
          refMax: scoring.max_employment,
          normalized: scoring.normalized_employment,
          weighted: scoring.weighted_employment,
        },
        house: {
          raw: scoring.raw_house,
          refMin: null,
          refMax: scoring.max_house,
          normalized: scoring.normalized_house,
          weighted: scoring.weighted_house,
        },
        family: {
          raw: scoring.raw_family,
          refMin: null,
          refMax: scoring.max_family,
          normalized: scoring.normalized_family,
          weighted: scoring.weighted_family,
        },
      };

      const criteria = bwmConfig.criteriaOptions.map((criterionMeta) => ({
        name: criterionMeta.key,
        type: 'benefit',
        raw: scoring.criteria_raw_map?.[criterionMeta.key] ?? (scoreByKey as any)[criterionMeta.key]?.raw ?? null,
        refMin: (scoreByKey as any)[criterionMeta.key]?.refMin ?? null,
        refMax: (scoreByKey as any)[criterionMeta.key]?.refMax ?? null,
        normalized: scoring.criteria_normalized_map?.[criterionMeta.key] ?? (scoreByKey as any)[criterionMeta.key]?.normalized ?? null,
        weight: bwmConfig.weights[criterionMeta.key] || 0,
        weighted: scoring.criteria_weighted_map?.[criterionMeta.key] ?? (scoreByKey as any)[criterionMeta.key]?.weighted ?? null,
      }));

      for (const criterion of criteria) {
        const criterionResult = await client.query(
          `INSERT INTO saw_criteria (name, criterion_type)
           VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET
             criterion_type = EXCLUDED.criterion_type
           RETURNING id`,
          [criterion.name, criterion.type]
        );

        const criterionId = criterionResult.rows[0].id;

        await client.query(
          `INSERT INTO saw_normalization_matrix (
            resident_id, criterion_id, raw_value,
            reference_min, reference_max, normalized_value, weight, weighted_value, calculated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT (resident_id, criterion_id) DO UPDATE SET
            raw_value = EXCLUDED.raw_value,
            reference_min = EXCLUDED.reference_min,
            reference_max = EXCLUDED.reference_max,
            normalized_value = EXCLUDED.normalized_value,
            weight = EXCLUDED.weight,
            weighted_value = EXCLUDED.weighted_value,
            calculated_at = CURRENT_TIMESTAMP`,
          [
            scoring.id,
            criterionId,
            criterion.raw,
            criterion.refMin,
            criterion.refMax,
            criterion.normalized,
            criterion.weight,
            criterion.weighted,
          ]
        );
      }

      await client.query(
        `UPDATE beneficiaries
         SET score = $1, status = $2
         WHERE resident_id = $3`,
        [scoring.score, scoring.status, scoring.id]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all beneficiaries for a period
 */
export async function getBeneficiariesByPeriod(periodId: number) {
  if (!periodId) {
    throw new Error('periodId query parameter is required');
  }

  try {
    const result = await pool.query(
      `SELECT
        b.id,
        b.period_id,
        b.resident_id,
        b.score,
        b.status,
        ROW_NUMBER() OVER (ORDER BY b.score DESC NULLS LAST, r.name ASC) AS rank,
        r.name,
        r.nik,
        r.monthly_income AS income,
        r.family_size AS dependents,
        r.house_conditions AS house_status
      FROM beneficiaries b
      JOIN residents r ON b.resident_id = r.id
      WHERE b.period_id = $1
      ORDER BY b.score DESC NULLS LAST`,
      [periodId]
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Get beneficiary by ID
 */

/**
 * Get aggregated statistics for all residents.
 * This runs in the backend for faster dashboard rendering on large datasets.
 */
export async function getAllResidentStatistics() {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*)::INT AS total,
        COALESCE(AVG(r.monthly_income) FILTER (WHERE r.monthly_income IS NOT NULL), 0)::FLOAT AS average_income,
        COUNT(*) FILTER (WHERE scr.status IN ('Layak', 'Sangat Layak'))::INT AS layak_count,
        COUNT(*) FILTER (WHERE scr.status = 'Tidak Layak')::INT AS tidak_layak_count,
        COUNT(*) FILTER (WHERE scr.status IS NULL OR scr.status = 'Pending')::INT AS pending_count
       FROM residents r
       LEFT JOIN saw_calculation_results scr ON scr.resident_id = r.id`
    );

    const row = result.rows[0] || {
      total: 0,
      average_income: 0,
      layak_count: 0,
      tidak_layak_count: 0,
      pending_count: 0,
    };

    const total = Number(row.total) || 0;
    const layakCount = Number(row.layak_count) || 0;
    const tidakLayakCount = Number(row.tidak_layak_count) || 0;
    const pendingCount = Number(row.pending_count) || 0;
    const averageIncome = Number(row.average_income) || 0;
    const layakPercentage = total > 0 ? (layakCount / total) * 100 : 0;

    return {
      source: 'all_residents',
      total,
      averageIncome,
      layakPercentage,
      chartData: [
        {
          name: 'Status Kelayakan',
          Layak: layakCount,
          'Tidak Layak': tidakLayakCount,
          Pending: pendingCount,
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}
export async function getBeneficiaryById(id: number) {
  try {
    const result = await pool.query(
      `SELECT
        b.id,
        b.period_id,
        b.resident_id,
        b.score,
        b.status,
        b.notes,
        r.name,
        r.nik,
        r.monthly_income,
        r.family_size,
        r.house_conditions,
        r.monthly_income AS income,
        r.family_size AS dependents,
        r.house_conditions AS house_status
      FROM beneficiaries b
      JOIN residents r ON b.resident_id = r.id
      WHERE b.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Beneficiary not found');
    }
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Create new beneficiary
 */
export async function createBeneficiary(
  period_id: number,
  resident_id: number,
  score?: number,
  status?: string
) {
  if (!period_id || !resident_id) {
    throw new Error('period_id and resident_id are required');
  }

  const finalScore = score !== undefined ? score : DEFAULT_BENEFICIARY_SCORE;
  const finalStatus = status || DEFAULT_BENEFICIARY_STATUS;

  try {
    const result = await pool.query(
      `INSERT INTO beneficiaries (period_id, resident_id, score, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [period_id, resident_id, finalScore, finalStatus]
    );

    // Auto-sync score/status based on pure SAW across all residents.
    await syncAllBeneficiaryScores();

    const refreshed = await pool.query(
      `SELECT id, period_id, resident_id, score, status
       FROM beneficiaries
       WHERE id = $1`,
      [result.rows[0].id]
    );

    return refreshed.rows[0];
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('This resident is already a beneficiary in this period.');
    }
    throw error;
  }
}

/**
 * Update beneficiary verification status and notes
 */
export async function updateBeneficiaryStatus(
  id: number,
  status: string,
  notes?: string
) {
  if (!status || !VALID_BENEFICIARY_STATUS.includes(status)) {
    throw new Error('Invalid status provided.');
  }

  try {
    const result = await pool.query(
      'UPDATE beneficiaries SET status = $1, notes = $2 WHERE id = $3',
      [status, notes || null, id]
    );

    if (result.rowCount === 0) {
      throw new Error('Beneficiary not found');
    }

    return { success: true, message: 'Beneficiary status updated.' };
  } catch (error) {
    throw error;
  }
}



