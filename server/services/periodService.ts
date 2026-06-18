import { pool } from '../database';

function normalizeScaleValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 9) return 9;
  return rounded;
}

async function resolvePeriodBwmConfig(input?: any): Promise<PeriodBwmConfig> {
  const fallback = await getRawSawBwmConfig();
  const defaults = getSawDefaultCriteriaOptions();

  const criteriaOptions = Array.isArray(input?.criteriaOptions)
    ? input.criteriaOptions
        .map((item: any) => {
          const key = String(item?.key || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '');
          if (!key) return null;
          return {
            key,
            label: String(item?.label || key),
            type: 'benefit' as const,
            source: item?.source === 'builtin' ? 'builtin' : 'custom',
          };
        })
        .filter(Boolean)
    : fallback.criteriaOptions || defaults;

  const allowed = new Set(criteriaOptions.map((item) => item.key));
  const rawActive = Array.isArray(input?.activeCriteria) ? input.activeCriteria : fallback.activeCriteria;
  const activeCriteria = rawActive
    .map((key: string) => String(key || '').trim().toLowerCase())
    .filter((key: string) => allowed.has(key));

  if (activeCriteria.length < 2) {
    throw new Error('Minimal 2 kriteria aktif untuk periode.');
  }

  const resolved = buildSawBwmConfig(activeCriteria, {
    criteria: activeCriteria,
    bestCriterion: input?.bestCriterion || fallback.bestCriterion,
    worstCriterion: input?.worstCriterion || fallback.worstCriterion,
    bestToOthers:
      activeCriteria.reduce((acc, key) => {
        const candidate = input?.bestToOthers?.[key] ?? fallback.bestToOthers?.[key] ?? 1;
        acc[key] = normalizeScaleValue(candidate);
        return acc;
      }, {} as Record<string, number>) || {},
    othersToWorst:
      activeCriteria.reduce((acc, key) => {
        const candidate = input?.othersToWorst?.[key] ?? fallback.othersToWorst?.[key] ?? 1;
        acc[key] = normalizeScaleValue(candidate);
        return acc;
      }, {} as Record<string, number>) || {},
  });

  return {
    criteriaOptions,
    activeCriteria: resolved.activeCriteria,
    bestCriterion: resolved.bwmInput.bestCriterion,
    worstCriterion: resolved.bwmInput.worstCriterion,
    bestToOthers: resolved.bwmInput.bestToOthers as Record<string, number>,
    othersToWorst: resolved.bwmInput.othersToWorst as Record<string, number>,
    weights: resolved.weights,
  };
}

function extractPeriodBwmConfig(periodRow: any): PeriodBwmConfig | null {
  const criteriaOptions = parseJsonColumn<SawCriteriaOption[]>(periodRow?.criteria_options, []);
  const activeCriteria = parseJsonColumn<string[]>(periodRow?.active_criteria, []);
  const bestToOthers = parseJsonColumn<Record<string, number>>(periodRow?.best_to_others, {});
  const othersToWorst = parseJsonColumn<Record<string, number>>(periodRow?.others_to_worst, {});
  const weights = parseJsonColumn<Record<string, number>>(periodRow?.weights, {});

  if (criteriaOptions.length === 0 || activeCriteria.length < 2 || !periodRow?.best_criterion || !periodRow?.worst_criterion) {
    return null;
  }

  return {
    criteriaOptions,
    activeCriteria,
    bestCriterion: String(periodRow.best_criterion),
    worstCriterion: String(periodRow.worst_criterion),
    bestToOthers,
    othersToWorst,
    weights,
  };
}

async function populateBeneficiariesForPeriod(
  client: PoolClient,
  periodId: number,
  quota: number | null,
  bwmConfig: PeriodBwmConfig
) {
  const limit = quota ?? 2147483647;

  await client.query('DELETE FROM beneficiaries WHERE period_id = $1', [periodId]);
  const residentsResult = await client.query(
    `SELECT id, monthly_income, poverty_level, house_conditions, family_size, criteria_scores, name
     FROM residents`
  );

  const sawResults = calculateMetodeSAWDetailed(residentsResult.rows, {
    activeCriteria: bwmConfig.activeCriteria,
    bwmInput: {
      criteria: bwmConfig.activeCriteria,
      bestCriterion: bwmConfig.bestCriterion,
      worstCriterion: bwmConfig.worstCriterion,
      bestToOthers: bwmConfig.bestToOthers,
      othersToWorst: bwmConfig.othersToWorst,
    },
    incompleteStatus: 'Pending',
  });

  const sorted = sawResults
    .map((row) => ({
      resident_id: Number(row.id),
      score: row.score,
      status: row.status,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, limit);

  if (sorted.length === 0) {
    return 0;
  }

  const placeholders: string[] = [];
  const values: Array<number | string | null> = [];
  let idx = 1;
  for (const row of sorted) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
    values.push(periodId, row.resident_id, row.score, row.status);
    idx += 4;
  }

  const insertResult = await client.query(
    `INSERT INTO beneficiaries (period_id, resident_id, score, status)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (period_id, resident_id) DO UPDATE SET
       score = EXCLUDED.score,
       status = EXCLUDED.status`,
    values
  );

  return insertResult.rowCount || sorted.length;
}

/**
 * Create new period
 */
export async function createPeriod(
  name: string,
  startDate: string,
  endDate: string,
  quota?: number,
  bwmConfigInput?: any
) {
  if (!name || !startDate || !endDate) {
    throw new Error('Missing required fields');
  }

  const parsedQuota = quota !== undefined && quota !== null ? Number(quota) : null;
  if (parsedQuota !== null && (!Number.isInteger(parsedQuota) || parsedQuota <= 0)) {
    throw new Error('Quota must be a positive integer');
  }

  const bwmConfig = await resolvePeriodBwmConfig(bwmConfigInput);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const periodResult = await client.query(
      `INSERT INTO periods (
        name, start_date, end_date, quota,
        criteria_options, active_criteria, best_criterion, worst_criterion, best_to_others, others_to_worst, weights
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
      RETURNING *`,
      [
        name,
        startDate,
        endDate,
        parsedQuota,
        JSON.stringify(bwmConfig.criteriaOptions),
        JSON.stringify(bwmConfig.activeCriteria),
        bwmConfig.bestCriterion,
        bwmConfig.worstCriterion,
        JSON.stringify(bwmConfig.bestToOthers),
        JSON.stringify(bwmConfig.othersToWorst),
        JSON.stringify(bwmConfig.weights),
      ]
    );
    const period = periodResult.rows[0];

    const autoGeneratedCount = await populateBeneficiariesForPeriod(client, period.id, parsedQuota, bwmConfig);

    await client.query('COMMIT');

    return {
      ...period,
      bwm_config: bwmConfig,
      auto_generated_beneficiaries: autoGeneratedCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all periods
 */
export async function getAllPeriods() {
  try {
    const result = await pool.query('SELECT * FROM periods ORDER BY start_date DESC');
    const mapped = await Promise.all(
      result.rows.map(async (row) => {
        const summary = await pool.query(
          `SELECT
             COUNT(*)::INT AS total,
             COUNT(*) FILTER (WHERE status IN ('Layak', 'Sangat Layak'))::INT AS accepted
           FROM beneficiaries
           WHERE period_id = $1`,
          [row.id]
        );
        return {
          ...row,
          recipient_count: summary.rows[0]?.total || 0,
          accepted_count: summary.rows[0]?.accepted || 0,
          bwm_config: extractPeriodBwmConfig(row),
        };
      })
    );
    return mapped;
  } catch (error) {
    throw error;
  }
}

/**
 * Get period by ID
 */
export async function getPeriodById(periodId: number) {
  try {
    const result = await pool.query('SELECT * FROM periods WHERE id = $1', [periodId]);
    if (result.rows.length === 0) {
      throw new Error('Period not found');
    }
    const period = result.rows[0];
    const summary = await pool.query(
      `SELECT
         COUNT(*)::INT AS total,
         COUNT(*) FILTER (WHERE status IN ('Layak', 'Sangat Layak'))::INT AS accepted
       FROM beneficiaries
       WHERE period_id = $1`,
      [periodId]
    );
    return {
      ...period,
      recipient_count: summary.rows[0]?.total || 0,
      accepted_count: summary.rows[0]?.accepted || 0,
      bwm_config: extractPeriodBwmConfig(period),
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Delete period and all beneficiaries in that period
 */
export async function deletePeriod(periodId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const beneficiariesDeleteResult = await client.query(
      `DELETE FROM beneficiaries
       WHERE period_id = $1`,
      [periodId]
    );

    const periodDeleteResult = await client.query(
      `DELETE FROM periods
       WHERE id = $1
       RETURNING id, name`,
      [periodId]
    );

    if (periodDeleteResult.rows.length === 0) {
      throw new Error('Period not found');
    }

    await client.query('COMMIT');

    return {
      success: true,
      deleted_period: periodDeleteResult.rows[0],
      deleted_beneficiaries: beneficiariesDeleteResult.rowCount || 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update period
 */
export async function updatePeriod(
  periodId: number,
  name: string,
  startDate: string,
  endDate: string,
  quota?: number | null,
  bwmConfigInput?: any
) {
  if (!name || !startDate || !endDate) {
    throw new Error('Missing required fields');
  }

  const parsedQuota = quota !== undefined && quota !== null ? Number(quota) : null;
  if (parsedQuota !== null && (!Number.isInteger(parsedQuota) || parsedQuota <= 0)) {
    throw new Error('Quota must be a positive integer');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingPeriodResult = await client.query(
      `SELECT *
       FROM periods
       WHERE id = $1`,
      [periodId]
    );

    if (existingPeriodResult.rows.length === 0) {
      throw new Error('Period not found');
    }

    const existingPeriod = existingPeriodResult.rows[0];
    const existingQuota = existingPeriod.quota !== null && existingPeriod.quota !== undefined
      ? Number(existingPeriod.quota)
      : null;
    const quotaChanged = existingQuota !== parsedQuota;
    const nextBwmConfig = await resolvePeriodBwmConfig(bwmConfigInput || extractPeriodBwmConfig(existingPeriod));
    const previousBwmConfig = extractPeriodBwmConfig(existingPeriod);
    const bwmChanged =
      !previousBwmConfig ||
      JSON.stringify(previousBwmConfig.activeCriteria) !== JSON.stringify(nextBwmConfig.activeCriteria) ||
      previousBwmConfig.bestCriterion !== nextBwmConfig.bestCriterion ||
      previousBwmConfig.worstCriterion !== nextBwmConfig.worstCriterion ||
      JSON.stringify(previousBwmConfig.bestToOthers) !== JSON.stringify(nextBwmConfig.bestToOthers) ||
      JSON.stringify(previousBwmConfig.othersToWorst) !== JSON.stringify(nextBwmConfig.othersToWorst);

    const result = await client.query(
      `UPDATE periods
       SET name = $1, start_date = $2, end_date = $3, quota = $4,
           criteria_options = $5::jsonb, active_criteria = $6::jsonb,
           best_criterion = $7, worst_criterion = $8,
           best_to_others = $9::jsonb, others_to_worst = $10::jsonb, weights = $11::jsonb
       WHERE id = $12
       RETURNING *`,
      [
        name,
        startDate,
        endDate,
        parsedQuota,
        JSON.stringify(nextBwmConfig.criteriaOptions),
        JSON.stringify(nextBwmConfig.activeCriteria),
        nextBwmConfig.bestCriterion,
        nextBwmConfig.worstCriterion,
        JSON.stringify(nextBwmConfig.bestToOthers),
        JSON.stringify(nextBwmConfig.othersToWorst),
        JSON.stringify(nextBwmConfig.weights),
        periodId,
      ]
    );

    const updatedPeriod = result.rows[0];
    let autoGeneratedCount = 0;

    if (quotaChanged || bwmChanged) {
      autoGeneratedCount = await populateBeneficiariesForPeriod(client, periodId, parsedQuota, nextBwmConfig);
    } else {
      const countResult = await client.query(
        `SELECT COUNT(*)::INT AS total
         FROM beneficiaries
         WHERE period_id = $1`,
        [periodId]
      );
      autoGeneratedCount = countResult.rows[0]?.total || 0;
    }

    await client.query('COMMIT');

    return {
      ...updatedPeriod,
      bwm_config: nextBwmConfig,
      auto_generated_beneficiaries: autoGeneratedCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply quota to period - mark top N beneficiaries as Layak
 */
export async function applyQuotaToPeriod(periodId: number) {
  try {
    const period = await getPeriodById(periodId);

    if (!period.quota || period.quota <= 0) {
      throw new Error('Period does not have a valid quota');
    }

    // Mark top N beneficiaries by score as Layak
    const updateResult = await pool.query(
      `UPDATE beneficiaries 
       SET status = 'Layak'
       WHERE id IN (
         SELECT id FROM beneficiaries 
         WHERE period_id = $1 
         ORDER BY score DESC 
         LIMIT $2
       )`,
      [periodId, period.quota]
    );

    // Mark remaining Pending as Tidak Layak
    await pool.query(
      `UPDATE beneficiaries 
       SET status = 'Tidak Layak'
       WHERE period_id = $1 AND status = 'Pending'`,
      [periodId]
    );

    return {
      success: true,
      message: `Applied quota: ${updateResult.rowCount} beneficiaries marked as Layak`,
      updated: updateResult.rowCount
    };
  } catch (error) {
    throw error;
  }
}
