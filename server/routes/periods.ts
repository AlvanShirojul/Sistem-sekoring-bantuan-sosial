import { Router, Request, Response } from 'express';
import * as periodService from '../services/periodService';

const router = Router();

/**
 * POST /api/periods
 * Create new period
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, start_date, end_date, quota, bwm_config } = req.body;
    const period = await periodService.createPeriod(name, start_date, end_date, quota, bwm_config);
    res.status(201).json(period);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/periods
 * Get all periods
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const periods = await periodService.getAllPeriods();
    res.json(periods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/periods/:periodId
 * Get period by ID
 */
router.get('/:periodId', async (req: Request, res: Response) => {
  try {
    const period = await periodService.getPeriodById(parseInt(req.params.periodId));
    res.json(period);
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
});

/**
 * PUT /api/periods/:periodId
 * Update period
 */
router.put('/:periodId', async (req: Request, res: Response) => {
  try {
    const { name, start_date, end_date, quota, bwm_config } = req.body;
    const period = await periodService.updatePeriod(
      parseInt(req.params.periodId),
      name,
      start_date,
      end_date,
      quota,
      bwm_config
    );
    res.json(period);
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
});

/**
 * DELETE /api/periods/:periodId
 * Delete a period and its beneficiaries
 */
router.delete('/:periodId', async (req: Request, res: Response) => {
  try {
    const result = await periodService.deletePeriod(parseInt(req.params.periodId));
    res.json(result);
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
});

/**
 * POST /api/period/:periodId/apply-quota
 * Apply quota to period - mark top N beneficiaries as Layak
 */
router.post('/:periodId/apply-quota', async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const result = await periodService.applyQuotaToPeriod(parseInt(periodId));
    res.json(result);
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
});

export default router;
