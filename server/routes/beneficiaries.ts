import { Router, Request, Response } from 'express';
import * as beneficiaryService from '../services/beneficiaryService';

const router = Router();

/**
 * GET /api/beneficiaries
 * Get all beneficiaries for a period
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const periodId = parseInt(req.query.periodId as string);
    const beneficiaries = await beneficiaryService.getBeneficiariesByPeriod(periodId);
    res.json(beneficiaries);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/beneficiaries/statistics
 * Get dashboard statistics summary
 * Query param source:
 * - all_residents: aggregate from all resident data (backend)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const source = String(req.query.source || 'all_residents').trim().toLowerCase();

    if (source !== 'all_residents') {
      return res.status(400).json({ error: 'Invalid source. Supported source: all_residents' });
    }

    const stats = await beneficiaryService.getAllResidentStatistics();
    res.json(stats);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/beneficiaries/bwm-config
 * Get SAW-BWM criteria configuration
 */
router.get('/bwm-config', async (_req: Request, res: Response) => {
  try {
    const config = await beneficiaryService.getSawBwmConfig();
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/beneficiaries/bwm-config
 * Update SAW-BWM criteria configuration and trigger score recalculation
 */
router.put('/bwm-config', async (req: Request, res: Response) => {
  try {
    const config = await beneficiaryService.saveSawBwmConfig(req.body || {});
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/beneficiaries/bwm-config/preview
 * Calculate BWM weights preview without saving and without triggering SAW recalculation
 */
router.post('/bwm-config/preview', async (req: Request, res: Response) => {
  try {
    const config = await beneficiaryService.previewSawBwmConfig(req.body || {});
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/beneficiaries/saw-history
 * Get SAW calculation history runs
 */
router.get('/saw-history', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const history = await beneficiaryService.getSawCalculationHistory(limit);
    res.json(history);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/beneficiary/:id
 * Get beneficiary by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const beneficiary = await beneficiaryService.getBeneficiaryById(parseInt(req.params.id));
    res.json(beneficiary);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /api/beneficiaries
 * Create new beneficiary
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { period_id, resident_id, score, status } = req.body;
    const beneficiary = await beneficiaryService.createBeneficiary(period_id, resident_id, score, status);
    res.status(201).json(beneficiary);
  } catch (error: any) {
    const statusCode = error.message.includes('already') ? 409 : 400;
    res.status(statusCode).json({ error: error.message });
  }
});

/**
 * POST /api/beneficiary/:id/verify
 * Update beneficiary verification status
 */
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const result = await beneficiaryService.updateBeneficiaryStatus(
      parseInt(req.params.id),
      status,
      notes
    );
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

export default router;
