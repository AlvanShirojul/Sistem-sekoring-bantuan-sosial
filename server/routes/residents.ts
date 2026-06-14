import { Router, Request, Response } from 'express';
import * as residentService from '../services/residentService';

const router = Router();

/**
 * GET /api/residents
 * Get all residents
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const search = (req.query.search as string) || '';

    const residents = await residentService.getAllResidents({ page, limit, search });
    res.json(residents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/residents
 * Create new resident
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const resident = await residentService.createResident(req.body);
    res.status(201).json(resident);
  } catch (error: any) {
    const status = error.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: error.message });
  }
});

/**
 * POST /api/residents/upsert
 * Create if NIK does not exist, otherwise require confirmation before update
 */
router.post('/upsert', async (req: Request, res: Response) => {
  try {
    const { confirm_update, ...residentData } = req.body;
    const result = await residentService.upsertResidentByNik(residentData, Boolean(confirm_update));

    if (result.action === 'confirmation_required') {
      return res.status(200).json({
        success: false,
        needs_confirmation: true,
        ...result,
      });
    }

    const statusCode = result.action === 'created' ? 201 : 200;
    return res.status(statusCode).json({
      success: true,
      needs_confirmation: false,
      ...result,
    });
  } catch (error: any) {
    const status = error.message.includes('already exists') ? 409 : 400;
    return res.status(status).json({ error: error.message });
  }
});

/**
 * GET /api/resident/:id
 * Get resident by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const resident = await residentService.getResidentById(parseInt(req.params.id));
    res.json(resident);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * PUT /api/resident/:id
 * Update resident
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const resident = await residentService.updateResident(parseInt(req.params.id), req.body);
    res.json(resident);
  } catch (error: any) {
    const status = error.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: error.message });
  }
});

/**
 * DELETE /api/resident/:id
 * Delete resident
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await residentService.deleteResident(parseInt(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /api/residents/bulk
 * Bulk insert residents
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const result = await residentService.bulkInsertResidents(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
