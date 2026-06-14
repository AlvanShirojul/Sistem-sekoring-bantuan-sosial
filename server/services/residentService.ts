import { pool } from '../database';
import { BATCH_INSERT_CHUNK_SIZE } from '../utils/constants';
import { syncAllBeneficiaryScores } from './beneficiaryService';

interface ResidentInput {
  name: string;
  nik: string;
  family_card_no?: string;
  address?: string;
  rt?: string;
  rw?: string;
  dusun?: string;
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  marital_status?: string;
  occupation?: string;
  phone_number?: string;
  email?: string;
  education?: string;
  monthly_income?: number | null;
  poverty_level?: string | null;
  house_conditions?: string | null;
  family_size?: number | null;
  criteria_scores?: Record<string, number | null>;
}

interface UpsertResidentResult {
  action: 'created' | 'updated' | 'confirmation_required';
  resident?: any;
  existing_resident?: any;
  incoming_data?: ResidentInput;
  message: string;
}

interface ResidentListOptions {
  page?: number;
  limit?: number;
  search?: string;
}

function validateRequiredResidentFields(data: ResidentInput) {
  const requiredChecks: Array<{ key: keyof ResidentInput; label: string }> = [
    { key: 'name', label: 'Nama Lengkap' },
    { key: 'nik', label: 'NIK' },
    { key: 'birth_place', label: 'Tempat Lahir' },
    { key: 'birth_date', label: 'Tanggal Lahir' },
    { key: 'gender', label: 'Jenis Kelamin' },
    { key: 'marital_status', label: 'Status Perkawinan' },
    { key: 'occupation', label: 'Pekerjaan' },
  ];

  const missing = requiredChecks
    .filter(({ key }) => {
      const value = data[key];
      return value === undefined || value === null || String(value).trim() === '';
    })
    .map(({ label }) => label);

  if (missing.length > 0) {
    throw new Error(`Field wajib belum lengkap: ${missing.join(', ')}`);
  }

  const structuredAddressFields: Array<keyof ResidentInput> = [
    'rt',
    'rw',
    'dusun',
    'desa',
    'kecamatan',
    'kabupaten',
  ];

  const hasStructuredAddress = structuredAddressFields.every((key) => {
    const value = data[key];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });

  const hasLegacyAddress = data.address !== undefined && data.address !== null && String(data.address).trim() !== '';

  if (!hasStructuredAddress && !hasLegacyAddress) {
    throw new Error('Field wajib belum lengkap: RT, RW, Dusun, Desa, Kecamatan, Kabupaten');
  }
}

function buildCombinedAddress(data: ResidentInput): string | null {
  const parts = [
    data.rt ? `RT ${data.rt}` : '',
    data.rw ? `RW ${data.rw}` : '',
    data.dusun || '',
    data.desa || '',
    data.kecamatan || '',
    data.kabupaten || '',
  ]
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join(', ');
  if (data.address && String(data.address).trim() !== '') return String(data.address).trim();
  return null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function toNullableText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * Get all residents
 */
export async function getAllResidents(options: ResidentListOptions = {}) {
  try {
    const page = Number.isFinite(Number(options.page)) ? Math.max(1, Number(options.page)) : 1;
    const limit = Number.isFinite(Number(options.limit)) ? Math.min(200, Math.max(1, Number(options.limit))) : 50;
    const offset = (page - 1) * limit;
    const search = (options.search || '').trim();

    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (search) {
      params.push(`%${search}%`);
      const searchParam = `$${params.length}`;
      whereClauses.push(
        `(r.name ILIKE ${searchParam}
          OR r.nik ILIKE ${searchParam}
          OR COALESCE(r.occupation, '') ILIKE ${searchParam}
          OR COALESCE(r.address, '') ILIKE ${searchParam})`
      );
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::INT AS total
       FROM residents r
       ${whereSQL}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const result = await pool.query(
      `SELECT
        r.id,
        r.name,
        r.nik,
        r.address,
        r.occupation,
        r.marital_status,
        scr.score AS saw_score,
        scr.status AS saw_status,
        scr.rank AS saw_rank
       FROM residents r
       LEFT JOIN saw_calculation_results scr ON scr.resident_id = r.id
       ${whereSQL}
       ORDER BY scr.score DESC NULLS LAST, r.name ASC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    return {
      items: result.rows,
      total,
      page,
      limit,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get resident by ID
 */
export async function getResidentById(id: number) {
  try {
    const result = await pool.query(
      `SELECT
        r.*,
        scr.score AS saw_score,
        scr.status AS saw_status,
        scr.rank AS saw_rank
       FROM residents r
       LEFT JOIN saw_calculation_results scr ON scr.resident_id = r.id
       WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Resident not found');
    }
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Create new resident
 */
export async function createResident(data: ResidentInput) {
  const {
    name,
    nik,
    family_card_no,
    rt,
    rw,
    dusun,
    desa,
    kecamatan,
    kabupaten,
    birth_place,
    birth_date,
    gender,
    marital_status,
    occupation,
    phone_number,
    email,
    education,
    monthly_income,
    poverty_level,
    house_conditions,
    family_size,
    criteria_scores,
  } = data;
  const address = buildCombinedAddress(data);
  const normalizedIncome = toNullableNumber(monthly_income);
  const normalizedFamilySize = toNullableInteger(family_size);
  const normalizedPovertyLevel = toNullableText(poverty_level);
  const normalizedHouseConditions = toNullableText(house_conditions);

  validateRequiredResidentFields(data);

  try {
    const result = await pool.query(
      `INSERT INTO residents (name, nik, family_card_no, address, rt, rw, dusun, desa, kecamatan, kabupaten, birth_place, birth_date, gender, marital_status, occupation, phone_number, email, education, monthly_income, poverty_level, house_conditions, family_size, criteria_scores)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb) RETURNING id`,
      [
        name,
        nik,
        family_card_no,
        address,
        rt,
        rw,
        dusun,
        desa,
        kecamatan,
        kabupaten,
        birth_place,
        birth_date,
        gender,
        marital_status,
        occupation,
        phone_number,
        email,
        education,
        normalizedIncome,
        normalizedPovertyLevel,
        normalizedHouseConditions,
        normalizedFamilySize,
        JSON.stringify(criteria_scores || {}),
      ]
    );
    await syncAllBeneficiaryScores();
    return { id: result.rows[0].id, ...data };
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('A resident with this NIK already exists.');
    }
    throw error;
  }
}

/**
 * Update resident
 */
export async function updateResident(id: number, data: ResidentInput) {
  const {
    name,
    nik,
    family_card_no,
    rt,
    rw,
    dusun,
    desa,
    kecamatan,
    kabupaten,
    birth_place,
    birth_date,
    gender,
    marital_status,
    occupation,
    phone_number,
    email,
    education,
    monthly_income,
    poverty_level,
    house_conditions,
    family_size,
    criteria_scores,
  } = data;
  const address = buildCombinedAddress(data);
  const normalizedIncome = toNullableNumber(monthly_income);
  const normalizedFamilySize = toNullableInteger(family_size);
  const normalizedPovertyLevel = toNullableText(poverty_level);
  const normalizedHouseConditions = toNullableText(house_conditions);

  if (!name || !nik) {
    throw new Error('Name and NIK are required');
  }

  try {
    const result = await pool.query(
      `UPDATE residents SET name = $1, nik = $2, family_card_no = $3, address = $4, rt = $5, rw = $6, dusun = $7, desa = $8, kecamatan = $9, kabupaten = $10, birth_place = $11, birth_date = $12, gender = $13, marital_status = $14, occupation = $15, phone_number = $16, email = $17, education = $18, monthly_income = $19, poverty_level = $20, house_conditions = $21, family_size = $22, criteria_scores = $23::jsonb
       WHERE id = $24`,
      [
        name,
        nik,
        family_card_no,
        address,
        rt,
        rw,
        dusun,
        desa,
        kecamatan,
        kabupaten,
        birth_place,
        birth_date,
        gender,
        marital_status,
        occupation,
        phone_number,
        email,
        education,
        normalizedIncome,
        normalizedPovertyLevel,
        normalizedHouseConditions,
        normalizedFamilySize,
        JSON.stringify(criteria_scores || {}),
        id,
      ]
    );

    if (result.rowCount === 0) {
      throw new Error('Resident not found');
    }

    await syncAllBeneficiaryScores();
    return { id, ...data };
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('A resident with this NIK already exists.');
    }
    throw error;
  }
}

/**
 * Upsert resident by NIK with optional confirmation for update
 */
export async function upsertResidentByNik(
  data: ResidentInput,
  confirmUpdate = false
): Promise<UpsertResidentResult> {
  const { nik } = data;

  validateRequiredResidentFields(data);

  const existing = await pool.query('SELECT * FROM residents WHERE nik = $1 LIMIT 1', [nik]);

  if (existing.rows.length === 0) {
    const created = await createResident(data);
    return {
      action: 'created',
      resident: created,
      message: 'Resident created successfully.',
    };
  }

  const existingResident = existing.rows[0];

  if (!confirmUpdate) {
    return {
      action: 'confirmation_required',
      existing_resident: existingResident,
      incoming_data: data,
      message: 'Resident with this NIK already exists. Confirmation is required before updating.',
    };
  }

  const updated = await updateResident(existingResident.id, data);
  return {
    action: 'updated',
    resident: updated,
    message: 'Resident updated successfully.',
  };
}

/**
 * Delete resident and associated beneficiaries
 */
export async function deleteResident(id: number) {
  try {
    // Delete beneficiaries first
    await pool.query('DELETE FROM beneficiaries WHERE resident_id = $1', [id]);

    // Then delete resident
    const result = await pool.query('DELETE FROM residents WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      throw new Error('Resident not found');
    }

    return { success: true, message: 'Resident deleted successfully.' };
  } catch (error) {
    throw error;
  }
}

/**
 * Bulk insert residents with error handling
 */
export async function bulkInsertResidents(residents: any[]) {
  if (!Array.isArray(residents) || residents.length === 0) {
    throw new Error('Request body must be a non-empty array of residents.');
  }

  let successful = 0;
  let failed = 0;
  const errors = [];
  const validResidents = [];

  const toNullableText = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
  };

  const toNullableNumber = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Validate all residents
  for (const resident of residents) {
    if (!resident.name || !resident.nik) {
      failed++;
      errors.push({ resident, error: 'Missing name or NIK' });
      continue;
    }

    const criteriaScores = Object.entries(resident).reduce((acc, [rawKey, rawValue]) => {
      const key = String(rawKey || '')
        .trim()
        .toLowerCase()
        .replace(/ /g, '_');

      if (!key.startsWith('criteria_')) {
        return acc;
      }

      const criterionKey = key
        .slice('criteria_'.length)
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');

      if (!criterionKey) {
        return acc;
      }

      acc[criterionKey] = toNullableNumber(rawValue);
      return acc;
    }, {} as Record<string, number | null>);

    const rt = toNullableText(resident.rt);
    const rw = toNullableText(resident.rw);
    const dusun = toNullableText(resident.dusun);
    const desa = toNullableText(resident.desa);
    const kecamatan = toNullableText(resident.kecamatan);
    const kabupaten = toNullableText(resident.kabupaten);
    const address =
      toNullableText(resident.address) ||
      [rt ? `RT ${rt}` : null, rw ? `RW ${rw}` : null, dusun, desa, kecamatan, kabupaten]
        .filter(Boolean)
        .join(', ') ||
      null;

    const fullResident = {
      name: String(resident.name).trim(),
      nik: String(resident.nik).trim(),
      family_card_no: toNullableText(resident.family_card_no),
      address,
      rt,
      rw,
      dusun,
      desa,
      kecamatan,
      kabupaten,
      birth_place: toNullableText(resident.birth_place || resident.tempat_lahir),
      birth_date: toNullableText(resident.birth_date || resident.tanggal_lahir),
      gender: toNullableText(resident.gender),
      marital_status: toNullableText(resident.marital_status || resident.status),
      occupation: toNullableText(resident.occupation || resident.pekerjaan),
      monthly_income: toNullableNumber(resident.monthly_income || resident.penghasilan),
      poverty_level: toNullableText(resident.poverty_level || resident.tingkat_kemiskinan),
      house_conditions: toNullableText(resident.house_conditions || resident.kondisi_rumah),
      family_size: toNullableInteger(resident.family_size || resident.jumlah_tanggungan),
      phone_number: toNullableText(resident.phone_number || resident.nomor_telepon),
      email: toNullableText(resident.email),
      education: toNullableText(resident.education || resident.pendidikan),
      criteria_scores: criteriaScores,
    };
    validResidents.push({ original: resident, validated: fullResident });
  }

  // Batch insert in chunks
  const chunkSize = BATCH_INSERT_CHUNK_SIZE;
  for (let i = 0; i < validResidents.length; i += chunkSize) {
    const chunk = validResidents.slice(i, i + chunkSize);
    const placeholders = [];
    const values = [];
    let paramCount = 1;

    chunk.forEach(({ validated }) => {
      placeholders.push(
        `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7}, $${paramCount + 8}, $${paramCount + 9}, $${paramCount + 10}, $${paramCount + 11}, $${paramCount + 12}, $${paramCount + 13}, $${paramCount + 14}, $${paramCount + 15}, $${paramCount + 16}, $${paramCount + 17}, $${paramCount + 18}, $${paramCount + 19}, $${paramCount + 20}, $${paramCount + 21}, $${paramCount + 22}::jsonb)`
      );
      values.push(
        validated.name,
        validated.nik,
        validated.family_card_no,
        validated.address,
        validated.rt,
        validated.rw,
        validated.dusun,
        validated.desa,
        validated.kecamatan,
        validated.kabupaten,
        validated.birth_place,
        validated.birth_date,
        validated.gender,
        validated.marital_status,
        validated.occupation,
        validated.monthly_income,
        validated.poverty_level,
        validated.house_conditions,
        validated.family_size,
        validated.phone_number,
        validated.email,
        validated.education,
        JSON.stringify(validated.criteria_scores || {})
      );
      paramCount += 23;
    });

    try {
      await pool.query(
        `INSERT INTO residents (name, nik, family_card_no, address, rt, rw, dusun, desa, kecamatan, kabupaten, birth_place, birth_date, gender, marital_status, occupation, monthly_income, poverty_level, house_conditions, family_size, phone_number, email, education, criteria_scores)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (nik) DO NOTHING`,
        values
      );
      successful += chunk.length;
    } catch (error) {
      // Fallback to individual insert for detailed error info
      for (const { original, validated } of chunk) {
        try {
          await pool.query(
            `INSERT INTO residents (name, nik, family_card_no, address, rt, rw, dusun, desa, kecamatan, kabupaten, birth_place, birth_date, gender, marital_status, occupation, monthly_income, poverty_level, house_conditions, family_size, phone_number, email, education, criteria_scores)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb)`,
            [
              validated.name,
              validated.nik,
              validated.family_card_no,
              validated.address,
              validated.rt,
              validated.rw,
              validated.dusun,
              validated.desa,
              validated.kecamatan,
              validated.kabupaten,
              validated.birth_place,
              validated.birth_date,
              validated.gender,
              validated.marital_status,
              validated.occupation,
              validated.monthly_income,
              validated.poverty_level,
              validated.house_conditions,
              validated.family_size,
              validated.phone_number,
              validated.email,
              validated.education,
              JSON.stringify(validated.criteria_scores || {})
            ]
          );
          successful++;
        } catch (itemError: any) {
          failed++;
          if (itemError.code === '23505') {
            errors.push({ resident: original, error: `NIK ${original.nik} already exists.` });
          } else {
            errors.push({ resident: original, error: 'An unknown database error occurred.' });
          }
        }
      }
    }
  }

  if (successful > 0) {
    await syncAllBeneficiaryScores();
  }

  return {
    message: `Impor selesai. Berhasil: ${successful}, Gagal: ${failed}`,
    successful,
    failed,
    errors
  };
}
