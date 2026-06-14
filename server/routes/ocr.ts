import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as ocrService from '../services/ocrService';
import * as residentService from '../services/residentService';

const router = Router();

// Configure multer untuk upload image
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'ktp-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * POST /api/ocr/upload-ktp
 * Upload KTP image dan proses OCR langsung via Gemini Vision
 */
router.post('/upload-ktp', upload.single('ktp_image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log(`Processing KTP image: ${req.file.filename}`);

    const ocrResult = await ocrService.sendImageToGemini(req.file.path);

    if (!ocrResult.success) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'OCR processing failed',
        details: ocrResult.error,
      });
    }

    const validation = ocrService.validateOCRData(ocrResult.data);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Data validation failed',
        validation_errors: validation.errors,
        extracted_data: ocrResult.data,
      });
    }

    const confidence = ocrService.getConfidenceScores(ocrResult.raw_response);

    res.json({
      success: true,
      message: 'Image processed successfully',
      extracted_data: validation.cleaned_data,
      confidence_scores: confidence,
      file_info: {
        filename: req.file.filename,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error: any) {
    console.error('Error processing KTP:', error);

    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore cleanup error
      }
    }

    res.status(500).json({
      error: 'Failed to process KTP image',
      details: error.message,
    });
  }
});

/**
 * POST /api/ocr/upload-ktp-url
 * OCR KTP image dari URL via Gemini Vision
 */
router.post('/upload-ktp-url', async (req: Request, res: Response) => {
  try {
    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }

    console.log(`Processing KTP URL: ${image_url}`);

    const ocrResult = await ocrService.sendImageUrlToGemini(image_url);

    if (!ocrResult.success) {
      return res.status(400).json({
        error: 'OCR processing failed',
        details: ocrResult.error,
      });
    }

    const validation = ocrService.validateOCRData(ocrResult.data);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Data validation failed',
        validation_errors: validation.errors,
        extracted_data: ocrResult.data,
      });
    }

    const confidence = ocrService.getConfidenceScores(ocrResult.raw_response);

    res.json({
      success: true,
      message: 'Image URL processed successfully',
      extracted_data: validation.cleaned_data,
      confidence_scores: confidence,
      image_url,
    });
  } catch (error: any) {
    console.error('Error processing KTP URL:', error);
    res.status(500).json({
      error: 'Failed to process KTP image URL',
      details: error.message,
    });
  }
});

/**
 * POST /api/ocr/create-resident-from-ktp
 * Langsung create resident dari extracted KTP data
 */
router.post('/create-resident-from-ktp', async (req: Request, res: Response) => {
  try {
    const { extracted_data, file_info } = req.body;

    if (!extracted_data) {
      return res.status(400).json({ error: 'extracted_data is required' });
    }

    const resident = await residentService.createResident({
      name: extracted_data.name,
      nik: extracted_data.nik,
      rt: extracted_data.rt,
      rw: extracted_data.rw,
      dusun: extracted_data.dusun,
      desa: extracted_data.desa,
      kecamatan: extracted_data.kecamatan,
      kabupaten: extracted_data.kabupaten,
      birth_place: extracted_data.birth_place,
      birth_date: extracted_data.birth_date,
      address: extracted_data.address,
      gender: extracted_data.gender,
      occupation: extracted_data.occupation,
    });

    res.status(201).json({
      success: true,
      message: 'Resident created from KTP data',
      resident,
      source: 'OCR - ' + (file_info?.filename || 'URL'),
    });
  } catch (error: any) {
    console.error('Error creating resident:', error);
    res.status(500).json({
      error: 'Failed to create resident',
      details: error.message,
    });
  }
});

/**
 * GET /api/ocr/health
 * Check Gemini OCR configuration
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!geminiKey) {
      return res.status(503).json({
        status: 'unconfigured',
        message: 'GEMINI_API_KEY not configured',
      });
    }

    res.json({
      status: 'ok',
      message: 'Gemini OCR service is configured',
      model: process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
