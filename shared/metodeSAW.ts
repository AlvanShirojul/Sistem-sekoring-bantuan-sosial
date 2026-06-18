import cp from 'child_process';
import path from 'path';

export interface SawScoringInput {
  id?: number | string;
  monthly_income?: number | null;
  poverty_level?: string | null;
  house_conditions?: string | null;
  family_size?: number | null;
  criteria_scores?: Record<string, number | null> | null;
}

export interface SawScoringResult {
  id?: number | string;
  isComplete: boolean;
  score: number | null;
  status: string;
  rank?: number | null;
}

export interface SawCalculationRow extends SawScoringResult {
  raw_income: number | null;
  raw_employment: number | null;
  raw_house: number | null;
  raw_family: number | null;
  raw_poverty: number | null; 
  max_poverty: number | null;
  normalized_poverty: number | null;
  weighted_poverty: number | null;
  min_income: number | null;
  max_income: number | null;
  max_employment: number | null;
  max_house: number | null;
  max_family: number | null;
  normalized_income: number | null;
  normalized_employment: number | null;
  normalized_house: number | null;
  normalized_family: number | null;
  weighted_income: number | null;
  weighted_employment: number | null;
  weighted_house: number | null;
  weighted_family: number | null;
  total_weighted_score: number | null;
  criteria_raw_map?: Record<string, number> | null;
  criteria_normalized_map?: Record<string, number> | null;
  criteria_weighted_map?: Record<string, number> | null;
}

export const SAW_CRITERIA_META = [
  { key: 'income', label: 'Penghasilan Bulanan', type: 'benefit' },
  { key: 'poverty', label: 'Tingkat Kemiskinan', type: 'benefit' },
  { key: 'house', label: 'Kondisi Rumah', type: 'benefit' },
  { key: 'family', label: 'Jumlah Tanggungan', type: 'benefit' },
  { key: 'employment', label: 'Status Pekerjaan', type: 'benefit' },
] as const;

export type SawKnownCriteriaKey = typeof SAW_CRITERIA_META[number]['key'];
export type SawCriteriaKey = string;

export interface SawCriteriaOption {
  key: SawCriteriaKey;
  label: string;
  type?: 'benefit' | 'cost';
  source?: 'builtin' | 'custom';
}

export const SAW_CRITERIA_LABELS: Record<SawKnownCriteriaKey, string> = {
  income: 'Penghasilan Bulanan',
  poverty: 'Tingkat Kemiskinan',
  house: 'Kondisi Rumah',
  family: 'Jumlah Tanggungan',
  employment: 'Status Pekerjaan',
};

const BUILTIN_CRITERIA_KEYS = SAW_CRITERIA_META.map((item) => item.key) as SawKnownCriteriaKey[];

function normalizeText(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function sanitizeCriteriaKey(input: unknown): string {
  const key = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '');
  return key;
}

export function getSawCriteriaKeys(): SawKnownCriteriaKey[] {
  return [...BUILTIN_CRITERIA_KEYS];
}

export function getSawDefaultCriteriaOptions(): SawCriteriaOption[] {
  // Builtin criteria options - parent criteria only (no sub-criteria)
  const options: SawCriteriaOption[] = [];

  for (const item of SAW_CRITERIA_META) {
    options.push({ key: item.key, label: item.label, type: item.type, source: 'builtin' });
  }

  return options;
}

/**
 * Expand active criteria: if a parent key (e.g. 'house') is present and there are
 * flattened child keys like 'house.permanen', expand the parent into its children.
 */
function expandActiveCriteria(activeCriteria: string[] | undefined, criteriaOptions: SawCriteriaOption[]) {
  const allowed = new Set(criteriaOptions.map((c) => c.key));
  const active = Array.isArray(activeCriteria) ? activeCriteria : SAW_CRITERIA_META.map((i) => i.key);
  const expanded: string[] = [];

  for (const key of active) {
    const sanitized = sanitizeCriteriaKey(key);
    if (!sanitized) continue;

    // find children: keys that start with `${sanitized}.`
    const children = criteriaOptions.filter((c) => c.key.startsWith(sanitized + '.')).map((c) => c.key);
    if (children.length > 0) {
      for (const child of children) expanded.push(child);
    } else if (allowed.has(sanitized)) {
      expanded.push(sanitized);
    }
  }

  const expandedMap = new Map<string, true>();
  for (const item of expanded) expandedMap.set(item, true);
  return Array.from(expandedMap.keys());
}

function getIncomeScore(income: number): number {
  if (income <= 1000000) return 100;
  if (income <= 2000000) return 85;
  if (income <= 3000000) return 70;
  if (income <= 4000000) return 50;
  return 30;
}

function getPovertyScore(level: string): number {
  const normalized = normalizeText(level);
  // legacy: not used in new criteria set, keep fallback behavior
  if (normalized.includes('sangat miskin')) return 100;
  if (normalized.includes('miskin')) return 85;
  if (normalized.includes('hampir miskin')) return 70;
  if (normalized.includes('tidak miskin')) return 35;
  return 60;
}

function getHouseScore(condition: string): number {
  // Use sub-criteria mapping provided by user:
  // Permanen -> 1, Semi Permanen -> 3, Non Permanen -> 5
  // We invert the mapping so that lower raw value -> higher SAW score (benefit),
  // then scale to 0-100 to remain consistent with other built-in scores.
  const normalized = normalizeText(condition);
  const mappingCandidates: Array<[RegExp, number]> = [
    [/permanen/, 1],
    [/semi ?permanen/, 3],
    [/non[-_ ]?permanen|tidak permanen/, 5],
  ];

  let mapped: number | null = null;
  for (const [re, val] of mappingCandidates) {
    if (re.test(normalized)) {
      mapped = val;
      break;
    }
  }

  // Fallback to heuristic if no exact match
  if (mapped === null) {
    if (normalized.includes('tidak layak') || normalized.includes('reyot') || normalized.includes('sangat buruk')) mapped = 5;
    else if (normalized.includes('kurang layak') || normalized.includes('sederhana')) mapped = 3;
    else if (normalized.includes('layak') || normalized.includes('baik') || normalized.includes('permanen')) mapped = 1;
    else mapped = 3;
  }

  const maxRaw = 5;
  const inverted = maxRaw - mapped + 1; // higher is better
  const scaled = Math.round((inverted / maxRaw) * 100);
  return scaled;
}

function getEmploymentScore(occupation: string): number {
  // Use sub-criteria mapping provided by user:
  // PNS -> 1, Swasta -> 2, Buruh -> 4, Tidak Bekerja -> 5
  // Invert then scale to 0-100 so higher means more eligible.
  const normalized = normalizeText(occupation);
  const mappingCandidates: Array<[RegExp, number]> = [
    [/pns|pegawai negeri|asn/, 1],
    [/swasta/, 2],
    [/buruh/, 4],
    [/tidak\s*bekerja|tidak bekerja|menganggur/, 5],
  ];

  let mapped: number | null = null;
  for (const [re, val] of mappingCandidates) {
    if (re.test(normalized)) {
      mapped = val;
      break;
    }
  }

  if (mapped === null) {
    // fallback heuristics
    if (normalized.includes('tidak') || normalized.includes('menganggur')) mapped = 5;
    else if (normalized.includes('buruh')) mapped = 4;
    else if (normalized.includes('swasta')) mapped = 2;
    else if (normalized.includes('pns') || normalized.includes('pegawai')) mapped = 1;
    else mapped = 3;
  }

  const maxRaw = 5;
  const inverted = maxRaw - mapped + 1;
  const scaled = Math.round((inverted / maxRaw) * 100);
  return scaled;
}

function getFamilySizeScore(size: number): number {
  if (size >= 6) return 100;
  if (size === 5) return 90;
  if (size === 4) return 75;
  if (size === 3) return 60;
  if (size === 2) return 45;
  return 30;
}

function toFiniteScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function resolveBuiltInScore(data: SawScoringInput, key: SawKnownCriteriaKey): number | null {
  if (key === 'income') {
    const rawIncome = Number(data.monthly_income);
    return Number.isFinite(rawIncome) ? getIncomeScore(rawIncome) : null;
  }
  if (key === 'employment') {
    const raw = (data as any).occupation || (data as any).job || (data as any).status_pekerjaan;
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    return getEmploymentScore(String(raw));
  }
  if (key === 'house') {
    const raw = data.house_conditions;
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    return getHouseScore(String(raw));
  }

  const rawFamily = Number(data.family_size);
  return Number.isFinite(rawFamily) ? getFamilySizeScore(rawFamily) : null;
}

function resolveCriterionScore(
  data: SawScoringInput,
  criterionKey: string,
  fallbackCustomScore: number | null
): number | null {
  if ((BUILTIN_CRITERIA_KEYS as string[]).includes(criterionKey)) {
    return resolveBuiltInScore(data, criterionKey as SawKnownCriteriaKey);
  }

  const customRaw = data.criteria_scores?.[criterionKey];
  const customScore = toFiniteScore(customRaw);
  if (customScore !== null) return customScore;
  return fallbackCustomScore;
}

export function getSawEligibilityStatus(score: number): string {
  if (score > 0.8) return 'Sangat Layak';
  if (score > 0.6) return 'Layak';
  return 'Tidak Layak';
}

export interface BwmInput {
  criteria: SawCriteriaKey[];
  bestCriterion: SawCriteriaKey;
  worstCriterion: SawCriteriaKey;
  bestToOthers: Partial<Record<SawCriteriaKey, number>>;
  othersToWorst: Partial<Record<SawCriteriaKey, number>>;
}

export interface SawScoringOptions {
  incompleteStatus?: string;
  activeCriteria?: SawCriteriaKey[];
  bwmInput?: Partial<BwmInput>;
  customCriteriaDefaultScore?: number | null;
}

const LEGACY_TARGET_WEIGHTS: Record<string, number> = {
  income: 0.30,
  poverty: 0.10,
  employment: 0.25,
  house: 0.20,
  family: 0.15,
};

function sanitizeComparison(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value;
}

export function sanitizeActiveCriteria(criteria?: unknown): string[] {
  const source = Array.isArray(criteria) ? criteria : BUILTIN_CRITERIA_KEYS;
  const sanitized = source
    .map((key) => sanitizeCriteriaKey(key))
    .filter(Boolean);

  if (sanitized.length === 0) {
    return [...BUILTIN_CRITERIA_KEYS];
  }

  return Array.from(new Set(sanitized));
}

function normalizeWeightsOnActive(
  weights: Record<string, number>,
  activeCriteria: string[]
): Record<string, number> {
  const normalized: Record<string, number> = {};
  const total = activeCriteria.reduce((sum, key) => sum + (weights[key] || 0), 0);

  if (total <= 0 || !Number.isFinite(total)) {
    const equal = activeCriteria.length > 0 ? 1 / activeCriteria.length : 0;
    for (const key of activeCriteria) {
      normalized[key] = equal;
    }
    return normalized;
  }

  for (const key of activeCriteria) {
    normalized[key] = (weights[key] || 0) / total;
  }

  return normalized;
}

export function createDefaultBwmInput(criteria: string[] = BUILTIN_CRITERIA_KEYS): BwmInput {
  const active = sanitizeActiveCriteria(criteria);
  const sorted = [...active].sort((a, b) => {
    const left = LEGACY_TARGET_WEIGHTS[b] ?? 1;
    const right = LEGACY_TARGET_WEIGHTS[a] ?? 1;
    return left - right;
  });

  const bestCriterion = sorted[0] || 'income';
  const worstCriterion = sorted[sorted.length - 1] || bestCriterion;

  const bestToOthers: Partial<Record<string, number>> = {};
  const othersToWorst: Partial<Record<string, number>> = {};

  const bestWeight = LEGACY_TARGET_WEIGHTS[bestCriterion] || 1;
  const worstWeight = LEGACY_TARGET_WEIGHTS[worstCriterion] || 1;

  for (const key of active) {
    const current = LEGACY_TARGET_WEIGHTS[key] || 1;
    bestToOthers[key] = sanitizeComparison(bestWeight / current);
    othersToWorst[key] = sanitizeComparison(current / worstWeight);
  }

  bestToOthers[bestCriterion] = 1;
  othersToWorst[worstCriterion] = 1;

  return {
    criteria: active,
    bestCriterion,
    worstCriterion,
    bestToOthers,
    othersToWorst,
  };
}

export function normalizeBwmInput(
  input?: Partial<BwmInput>,
  activeCriteriaFromArg?: string[]
): BwmInput {
  const activeCriteria = sanitizeActiveCriteria(activeCriteriaFromArg || input?.criteria);
  const base = createDefaultBwmInput(activeCriteria);

  const sanitizedBest = sanitizeCriteriaKey(input?.bestCriterion);
  const sanitizedWorst = sanitizeCriteriaKey(input?.worstCriterion);

  const bestCriterion = activeCriteria.includes(sanitizedBest) ? sanitizedBest : base.bestCriterion;
  const worstCriterion = activeCriteria.includes(sanitizedWorst) ? sanitizedWorst : base.worstCriterion;

  const bestToOthers: Partial<Record<string, number>> = { ...base.bestToOthers };
  const othersToWorst: Partial<Record<string, number>> = { ...base.othersToWorst };

  for (const key of activeCriteria) {
    const rawBest = input?.bestToOthers?.[key];
    const rawWorst = input?.othersToWorst?.[key];

    if (rawBest !== undefined) {
      bestToOthers[key] = sanitizeComparison(Number(rawBest));
    }
    if (rawWorst !== undefined) {
      othersToWorst[key] = sanitizeComparison(Number(rawWorst));
    }
  }

  bestToOthers[bestCriterion] = 1;
  othersToWorst[worstCriterion] = 1;

  return {
    criteria: activeCriteria,
    bestCriterion,
    worstCriterion,
    bestToOthers,
    othersToWorst,
  };
}

export function calculateBwmWeights(
  input?: Partial<BwmInput>,
  activeCriteriaArg?: string[]
): Record<string, number> {
  const normalizedInput = normalizeBwmInput(input, activeCriteriaArg);

  // 1. Jalankan solver Python jika env diaktifkan
  try {
    if (typeof process !== 'undefined' && process?.env?.USE_PY_BWM === '1') {
      const script = path.join(process.cwd(), 'tools', 'bwm_solver.py');
      
      const spawnResult = cp.spawnSync(
        process.env.PYTHON || 'python',
        [script],
        { 
          input: JSON.stringify(normalizedInput), 
          encoding: 'utf8', 
          maxBuffer: 10 * 1024 * 1024 
        }
      );

      if (spawnResult && spawnResult.status === 0 && spawnResult.stdout) {
        const parsed = JSON.parse(spawnResult.stdout.toString());
        if (parsed && typeof parsed === 'object' && parsed.weights) {
          return parsed.weights as Record<string, number>;
        }
      }
    }
  } catch (err) {
    console.warn("Koneksi ke Python solver gagal, menggunakan fallback JS.");
  }

  // 2. Jalur fallback: multiplicative BWM (LLSM analytical solution)
  //    w_j ∝ sqrt(a_jW / a_Bj), normalized to sum = 1
  const activeCriteria = normalizedInput.criteria;
  const rawWeights: Record<string, number> = {};

  for (const key of activeCriteria) {
    const aBj = sanitizeComparison(Number(normalizedInput.bestToOthers[key] ?? 1));
    const ajW = sanitizeComparison(Number(normalizedInput.othersToWorst[key] ?? 1));
    rawWeights[key] = Math.sqrt(ajW / aBj);
  }

  return normalizeWeightsOnActive(rawWeights, activeCriteria);
}

export function buildSawBwmConfig(
  activeCriteria?: string[],
  bwmInput?: Partial<BwmInput>
): {
  activeCriteria: string[];
  bwmInput: BwmInput;
  weights: Record<string, number>;
} {
  const criteriaOptions = getSawDefaultCriteriaOptions();
  const initial = sanitizeActiveCriteria(activeCriteria || bwmInput?.criteria);

  // BWM: compute weights on parent criteria only, then distribute to children
  const parentCriteria = initial.filter((key) => !key.includes('.'));
  const parentWeights = calculateBwmWeights(
    { ...bwmInput, criteria: parentCriteria },
    parentCriteria
  );

  // Expand criteria for SAW scoring, distributing parent weight equally to children
  const criteria = expandActiveCriteria(initial, criteriaOptions);
  const distributedWeights: Record<string, number> = {};
  for (const key of criteria) {
    if (!key.includes('.')) {
      distributedWeights[key] = parentWeights[key] || 0;
    } else {
      const parent = key.split('.')[0];
      const siblings = criteria.filter((k) => k.startsWith(parent + '.'));
      const perChild = siblings.length > 0
        ? (parentWeights[parent] || 0) / siblings.length
        : 0;
      distributedWeights[key] = perChild;
    }
  }

  // Normalize to ensure sum = 1
  const weights = normalizeWeightsOnActive(distributedWeights, criteria);

  // BWM input only uses parent criteria (no sub-criteria)
  const parsedInput = { ...bwmInput, criteria: parentCriteria };
  const normalizedInput = normalizeBwmInput(parsedInput, parentCriteria);

  return {
    activeCriteria: criteria,
    bwmInput: normalizedInput,
    weights,
  };
}

export const DEFAULT_BWM_INPUT: BwmInput = createDefaultBwmInput();
export const SAW_BWM_WEIGHTS = calculateBwmWeights(DEFAULT_BWM_INPUT, DEFAULT_BWM_INPUT.criteria);

export function getSawBwmWeights(options?: {
  activeCriteria?: string[];
  bwmInput?: Partial<BwmInput>;
}): Record<string, number> {
  if (!options) {
    return { ...SAW_BWM_WEIGHTS };
  }

  return calculateBwmWeights(options.bwmInput, options.activeCriteria);
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function buildIncompleteRow(id: number | string | undefined, status: string): SawCalculationRow {
  return {
    id,
    isComplete: false,
    score: null,
    status,
    rank: null,
    raw_income: null,
    raw_employment: null,
    raw_poverty: null,
    raw_house: null,
    raw_family: null,
    min_income: null,
    max_income: null,
    max_employment: null,
    max_poverty: null,
    max_house: null,
    max_family: null,
    normalized_income: null,
    normalized_employment: null,
    normalized_poverty: null,
    normalized_house: null,
    normalized_family: null,
    weighted_income: null,
    weighted_employment: null,
    weighted_poverty: null,
    weighted_house: null,
    weighted_family: null,
    total_weighted_score: null,
    criteria_raw_map: null,
    criteria_normalized_map: null,
    criteria_weighted_map: null,
  };
}

function mapBuiltInOrNull(map: Record<string, number> | undefined, key: SawKnownCriteriaKey): number | null {
  const value = map?.[key];
  if (value === undefined || !Number.isFinite(value)) return null;
  return value;
}

export function calculateMetodeSAWForResidents(
  residents: SawScoringInput[],
  options?: SawScoringOptions
): SawScoringResult[] {
  return calculateMetodeSAWDetailed(residents, options).map((row) => ({
    id: row.id,
    isComplete: row.isComplete,
    score: row.score,
    status: row.status,
    rank: row.rank,
  }));
}

export function calculateMetodeSAWDetailed(
  residents: SawScoringInput[],
  options?: SawScoringOptions
): SawCalculationRow[] {
  const incompleteStatus = options?.incompleteStatus || 'Pending';
  const customDefaultScore = options?.customCriteriaDefaultScore ?? 60;
  const { activeCriteria, weights } = buildSawBwmConfig(options?.activeCriteria, options?.bwmInput);

  const prepared = residents.map((resident) => {
    const numeric: Record<string, number> = {};
    let complete = true;

    for (const criterionKey of activeCriteria) {
      const score = resolveCriterionScore(resident, criterionKey, customDefaultScore);
      if (score === null) {
        complete = false;
        break;
      }
      numeric[criterionKey] = score;
    }

    return {
      resident,
      complete,
      numeric: complete ? numeric : null,
    };
  });

  const completeRows = prepared.filter((row) => row.complete && row.numeric !== null);

  if (completeRows.length === 0) {
    return prepared.map((row) => buildIncompleteRow(row.resident.id, incompleteStatus));
  }

  const maxByCriterion: Record<string, number> = {};
  for (const key of activeCriteria) {
    maxByCriterion[key] = Math.max(...completeRows.map((row) => row.numeric![key]));
  }

  const minIncome = activeCriteria.includes('income')
    ? Math.min(...completeRows.map((row) => row.numeric!['income']))
    : null;
  const maxIncome = activeCriteria.includes('income') ? maxByCriterion['income'] : null;
  const maxEmployment = activeCriteria.includes('employment') ? maxByCriterion['employment'] : null;
  const maxHouse = activeCriteria.includes('house') ? maxByCriterion['house'] : null;
  const maxFamily = activeCriteria.includes('family') ? maxByCriterion['family'] : null;

  const weightedComplete = completeRows.map((row) => {
    const numeric = row.numeric!;
    const normalized: Record<string, number> = {};
    const weighted: Record<string, number> = {};

    for (const key of activeCriteria) {
      normalized[key] = safeDivide(numeric[key], maxByCriterion[key]);
      weighted[key] = normalized[key] * (weights[key] || 0);
    }

    const weightedScore = activeCriteria.reduce((sum, key) => sum + (weighted[key] || 0), 0);
    const finalScore = Number(weightedScore.toFixed(2));

    return {
      id: row.resident.id,
      isComplete: true,
      score: finalScore,
      status: getSawEligibilityStatus(finalScore),
      raw_income: mapBuiltInOrNull(numeric, 'income'),
      raw_employment: mapBuiltInOrNull(numeric, 'employment'),
      raw_house: mapBuiltInOrNull(numeric, 'house'),
      raw_family: mapBuiltInOrNull(numeric, 'family'),
      min_income: minIncome,
      max_income: maxIncome,
      max_employment: maxEmployment,
      max_house: maxHouse,
      max_family: maxFamily,
      normalized_income: mapBuiltInOrNull(normalized, 'income'),
      normalized_employment: mapBuiltInOrNull(normalized, 'employment'),
      normalized_house: mapBuiltInOrNull(normalized, 'house'),
      normalized_family: mapBuiltInOrNull(normalized, 'family'),
      weighted_income: mapBuiltInOrNull(weighted, 'income'),
      weighted_employment: mapBuiltInOrNull(weighted, 'employment'),
      weighted_house: mapBuiltInOrNull(weighted, 'house'),
      weighted_family: mapBuiltInOrNull(weighted, 'family'),
      total_weighted_score: weightedScore,
      criteria_raw_map: numeric,
      criteria_normalized_map: normalized,
      criteria_weighted_map: weighted,
    } as SawCalculationRow;
  });

  const ranked = [...weightedComplete]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  const rankById = new Map(ranked.map((row) => [row.id, row.rank]));
  const completeById = new Map(ranked.map((row) => [row.id, row]));

  return prepared.map((row) => {
    if (!row.complete) {
      return buildIncompleteRow(row.resident.id, incompleteStatus);
    }

    const scored = completeById.get(row.resident.id);
    const rankedRow = completeById.get(row.resident.id);
    return {
      id: row.resident.id,
      isComplete: true,
      score: scored?.score ?? null,
      status: scored?.status || incompleteStatus,
      rank: rankById.get(row.resident.id) ?? null,
      raw_income: rankedRow?.raw_income ?? null,
      raw_employment: rankedRow?.raw_employment ?? null,
      raw_poverty: rankedRow?.raw_poverty ?? null,
      raw_house: rankedRow?.raw_house ?? null,
      raw_family: rankedRow?.raw_family ?? null,
      min_income: rankedRow?.min_income ?? null,
      max_income: rankedRow?.max_income ?? null,
      max_employment: rankedRow?.max_employment ?? null,
      max_poverty: rankedRow?.max_poverty ?? null,
      max_house: rankedRow?.max_house ?? null,
      max_family: rankedRow?.max_family ?? null,
      normalized_income: rankedRow?.normalized_income ?? null,
      normalized_employment: rankedRow?.normalized_employment ?? null,
      normalized_poverty: rankedRow?.normalized_poverty ?? null,
      normalized_house: rankedRow?.normalized_house ?? null,
      normalized_family: rankedRow?.normalized_family ?? null,
      weighted_income: rankedRow?.weighted_income ?? null,
      weighted_employment: rankedRow?.weighted_employment ?? null,
      weighted_poverty: rankedRow?.weighted_poverty ?? null,
      weighted_house: rankedRow?.weighted_house ?? null,
      weighted_family: rankedRow?.weighted_family ?? null,
      total_weighted_score: rankedRow?.total_weighted_score ?? null,
      criteria_raw_map: rankedRow?.criteria_raw_map ?? null,
      criteria_normalized_map: rankedRow?.criteria_normalized_map ?? null,
      criteria_weighted_map: rankedRow?.criteria_weighted_map ?? null,
    } as SawCalculationRow;
  });
}

export function calculateMetodeSAW(
  data: SawScoringInput,
  options?: SawScoringOptions
): SawScoringResult {
  const results = calculateMetodeSAWForResidents([data], options);
  return results[0];
}
