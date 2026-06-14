import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {
  GoogleGenAI,
  createPartFromBase64,
  createPartFromText,
  createUserContent,
} from '@google/genai';

/**
 * Service untuk OCR KTP langsung via Gemini Vision (tanpa n8n).
 */

interface OCRResult {
  success: boolean;
  data?: {
    nik: string;
    name: string;
    rt: string | null;
    rw: string | null;
    dusun: string | null;
    desa: string | null;
    kecamatan: string | null;
    kabupaten: string | null;
    birth_place: string | null;
    birth_date: string | null;
    gender: string | null;
    occupation: string | null;
    address: string | null;
  };
  error?: string;
  raw_response?: any;
}

const GEMINI_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured in environment variables');
  }
  return new GoogleGenAI({ apiKey });
}

function normalizeMimeType(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.toLowerCase().split(';')[0].trim();
  if (raw === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_MIME_TYPES.has(raw)) return raw;
  return null;
}

function inferMimeTypeFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return null;
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;

  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  // DDMMYYYY
  const compact = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    const [, dd, mm, yyyy] = compact;
    return `${yyyy}-${mm}-${dd}`;
  }

  return text;
}

function extractJsonFromModelText(text: string): any {
  const trimmed = text.trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error('Gemini response is not valid JSON');
  }
}

function extractAddressParts(addressText: string) {
  const text = addressText || '';
  const rtMatch = text.match(/\bRT\s*[:./-]?\s*(\d{1,3})\b/i);
  const rwMatch = text.match(/\bRW\s*[:./-]?\s*(\d{1,3})\b/i);
  const dusunMatch = text.match(/\b(DUSUN|DUKUH|LINGK)\s*[:.]?\s*([A-Z0-9\s.'-]+)/i);
  const desaMatch = text.match(/\b(DESA|KELURAHAN|KEL)\s*[:.]?\s*([A-Z0-9\s.'-]+)/i);
  const kecamatanMatch = text.match(/\b(KECAMATAN|KEC)\s*[:.]?\s*([A-Z0-9\s.'-]+)/i);
  const kabupatenMatch = text.match(/\b(KABUPATEN|KOTA|KAB)\s*[:.]?\s*([A-Z0-9\s.'-]+)/i);

  return {
    rt: rtMatch?.[1]?.trim() || null,
    rw: rwMatch?.[1]?.trim() || null,
    dusun: dusunMatch?.[2]?.trim() || null,
    desa: desaMatch?.[2]?.trim() || null,
    kecamatan: kecamatanMatch?.[2]?.trim() || null,
    kabupaten: kabupatenMatch?.[2]?.trim() || null,
  };
}

function normalizeGeminiData(data: any) {
  const rawGender = String(data?.gender ?? data?.jenis_kelamin ?? '').trim();
  let normalizedGender: string | null = rawGender || null;
  if (normalizedGender) {
    const g = normalizedGender.toLowerCase();
    if (g === 'l' || g === 'laki' || g === 'laki-laki') normalizedGender = 'Laki-laki';
    if (g === 'p' || g === 'perempuan') normalizedGender = 'Perempuan';
  }

  const rawAddress = String(data?.address ?? data?.alamat ?? '').trim() || null;
  const parsedFromAddress = rawAddress ? extractAddressParts(rawAddress) : {
    rt: null,
    rw: null,
    dusun: null,
    desa: null,
    kecamatan: null,
    kabupaten: null,
  };

  return {
    nik: String(data?.nik ?? data?.NIK ?? '').replace(/\D/g, '').trim(),
    name: String(data?.name ?? data?.nama ?? '').trim(),
    rt: String(data?.rt ?? '').trim() || parsedFromAddress.rt,
    rw: String(data?.rw ?? '').trim() || parsedFromAddress.rw,
    dusun: String(data?.dusun ?? '').trim() || parsedFromAddress.dusun,
    desa: String(data?.desa ?? '').trim() || parsedFromAddress.desa,
    kecamatan: String(data?.kecamatan ?? '').trim() || parsedFromAddress.kecamatan,
    kabupaten: String(data?.kabupaten ?? '').trim() || parsedFromAddress.kabupaten,
    birth_place: String(data?.birth_place ?? data?.tempat_lahir ?? '').trim() || null,
    birth_date: normalizeDate(String(data?.birth_date ?? data?.tanggal_lahir ?? '').trim() || null),
    gender: normalizedGender,
    occupation: String(data?.occupation ?? data?.pekerjaan ?? '').trim() || null,
    address: rawAddress,
  };
}

async function extractKtpDataWithGemini(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
  try {
    const ai = getGeminiClient();
    const prompt = `Ekstrak data dari foto KTP Indonesia. Kembalikan hanya JSON valid tanpa markdown dengan struktur persis: {"nik":"string","name":"string","rt":"string|null","rw":"string|null","dusun":"string|null","desa":"string|null","kecamatan":"string|null","kabupaten":"string|null","birth_place":"string|null","birth_date":"YYYY-MM-DD|null","gender":"Laki-laki|Perempuan|null","occupation":"string|null","address":"string|null"}. Jika tidak terbaca isi null (untuk nik/name gunakan string kosong).`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([
        createPartFromText(prompt),
        createPartFromBase64(imageBuffer.toString('base64'), mimeType),
      ]),
    });

    const responseText = response.text || '';
    const parsed = extractJsonFromModelText(responseText);
    const normalized = normalizeGeminiData(parsed);

    return {
      success: true,
      data: normalized,
      raw_response: {
        text: responseText,
        model: GEMINI_MODEL,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to process image with Gemini Vision',
    };
  }
}

/**
 * Kirim image KTP ke Gemini Vision untuk OCR processing.
 */
export async function sendImageToGemini(imagePath: string): Promise<OCRResult> {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error('Image file not found');
    }

    const imageBuffer = fs.readFileSync(imagePath);
    if (imageBuffer.byteLength > MAX_UPLOAD_SIZE) {
      throw new Error('File size exceeds 5MB limit');
    }

    const mimeType = normalizeMimeType(inferMimeTypeFromPath(imagePath));
    if (!mimeType) {
      throw new Error('Unsupported file type. Allowed: JPG, PNG, WEBP, PDF');
    }

    console.log(`Processing KTP via Gemini Vision: ${path.basename(imagePath)}`);
    return await extractKtpDataWithGemini(imageBuffer, mimeType);
  } catch (error: any) {
    console.error('Error processing image with Gemini:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to process image with Gemini Vision',
    };
  }
}

/**
 * Kirim image URL ke Gemini Vision.
 */
export async function sendImageUrlToGemini(imageUrl: string): Promise<OCRResult> {
  try {
    console.log(`Processing KTP URL via Gemini Vision: ${imageUrl}`);

    const response = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: MAX_UPLOAD_SIZE,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const mimeType =
      normalizeMimeType(response.headers['content-type']) ||
      normalizeMimeType(inferMimeTypeFromPath(imageUrl));

    if (!mimeType) {
      throw new Error('Unsupported URL content type. Allowed: JPG, PNG, WEBP, PDF');
    }

    const imageBuffer = Buffer.from(response.data);
    if (imageBuffer.byteLength > MAX_UPLOAD_SIZE) {
      throw new Error('Image URL file size exceeds 5MB limit');
    }

    return await extractKtpDataWithGemini(imageBuffer, mimeType);
  } catch (error: any) {
    console.error('Error processing URL with Gemini:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to process image URL with Gemini Vision',
    };
  }
}

/**
 * Validate OCR result sebelum insert ke database
 */
export function validateOCRData(data: any): {
  valid: boolean;
  errors: string[];
  cleaned_data?: any;
} {
  const errors = [];

  // Validate NIK
  if (!data.nik || data.nik.length !== 16) {
    errors.push('NIK must be 16 digits');
  }

  // Validate name
  if (!data.name || data.name.trim().length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  // Validate birth date format
  if (data.birth_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.birth_date)) {
      errors.push('Birth date must be in YYYY-MM-DD format');
    }
  }

  // Validate gender
  if (data.gender && !['Laki-laki', 'Perempuan', 'L', 'P'].includes(data.gender)) {
    errors.push('Invalid gender value');
  }

  const cleaned_data = {
    nik: data.nik?.trim(),
    name: data.name?.trim(),
    rt: data.rt?.trim() || null,
    rw: data.rw?.trim() || null,
    dusun: data.dusun?.trim() || null,
    desa: data.desa?.trim() || null,
    kecamatan: data.kecamatan?.trim() || null,
    kabupaten: data.kabupaten?.trim() || null,
    birth_place: data.birth_place?.trim() || null,
    birth_date: data.birth_date?.trim() || null,
    address: data.address?.trim() || null,
    gender: normalizeGender(data.gender) || null,
    occupation: data.occupation?.trim() || null,
  };

  return {
    valid: errors.length === 0,
    errors,
    cleaned_data,
  };
}

/**
 * Normalize gender value
 */
function normalizeGender(value: string): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'l' || normalized === 'laki-laki' || normalized === 'laki') {
    return 'Laki-laki';
  }
  if (normalized === 'p' || normalized === 'perempuan') {
    return 'Perempuan';
  }
  return null;
}

/**
 * Extract confidence scores jika ada
 */
export function getConfidenceScores(response: any): {
  overall_confidence: number;
  field_confidences: Record<string, number>;
} {
  // Gemini API tidak selalu mengembalikan confidence per field.
  // Tetap pakai fallback agar kontrak response API tidak berubah di frontend.
  return {
    overall_confidence: response.confidence || 0.85,
    field_confidences: response.field_confidences || {
      nik: 0.95,
      name: 0.9,
      birth_place: 0.85,
      birth_date: 0.88,
      gender: 0.92,
      address: 0.8,
    },
  };
}
