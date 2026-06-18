import express from 'express';
import { getAllPeriods } from '../services/beneficiaryService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/api/periods', authenticateToken, async (req, res) => {
  try {
    const periods = await getAllPeriods();
    res.json(periods);
  } catch (error) {
    console.error('Error fetching periods:', error);
    res.status(500).json({ error: 'Gagal memuat data periode' });
  }
});

export default router;