import { Router } from 'express';
import authRoutes from './auth';
import periodRoutes from './periods';
import residentRoutes from './residents';
import beneficiaryRoutes from './beneficiaries';
import ocrRoutes from './ocr';

const router = Router();

/**
 * API route aggregator
 * All routes are mounted here
 */

// Auth and public routes
router.use('/', authRoutes);

// Protected routes
router.use('/periods', periodRoutes);
router.use('/period', periodRoutes);
router.use('/residents', residentRoutes);
router.use('/resident', residentRoutes);
router.use('/beneficiaries', beneficiaryRoutes);
router.use('/beneficiary', beneficiaryRoutes);
router.use('/ocr', ocrRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
  