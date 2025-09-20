import { Router, Response } from 'express';
import { query } from '../database/connection';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// Endpoint to get emotion analytics data
router.get('/emotions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // For now, we will get the count of each risk level from the wellness_surveys table
  const emotionData = await query(`
    SELECT 
      risk_level, 
      COUNT(*) as count 
    FROM wellness_surveys 
    WHERE risk_level IS NOT NULL
    GROUP BY risk_level
  `);

  res.json({
    success: true,
    data: emotionData.rows,
  });
}));

export default router;