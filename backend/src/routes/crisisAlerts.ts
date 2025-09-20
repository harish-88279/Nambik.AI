import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { io } from '../services/socketService';

const router = Router();

// Self-report a crisis alert
router.post('/self-report', [
  body('description').isLength({ min: 10, max: 1000 }),
  body('severity').isInt({ min: 1, max: 10 }),
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const { description, severity } = req.body;

  const alertResult = await query(
    `INSERT INTO crisis_alerts (user_id, alert_type, severity_level, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, 'self_reported', severity, description]
  );

  const newAlert = alertResult.rows[0];

  // Emit a real-time notification to admins
  io.emit('newCrisisAlert', {
    id: newAlert.id,
    userId: newAlert.user_id,
    description: newAlert.description,
    severity: newAlert.severity_level,
    timestamp: newAlert.created_at,
  });

  res.status(201).json({
    success: true,
    message: 'Crisis alert reported successfully',
    alert: newAlert,
  });
}));

// Counselor reports a crisis alert for a user
router.post('/report-for-user', requireRole(['counselor', 'college_admin', 'ngo_admin']), [
  body('userId').isUUID(),
  body('description').isLength({ min: 10, max: 1000 }),
  body('severity').isInt({ min: 1, max: 10 }),
] , asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const reporterId = req.user!.id; // The counselor reporting
  const { userId, description, severity } = req.body;

  // Verify the target user exists
  const userExists = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (userExists.rows.length === 0) {
    throw new CustomError('Target user not found', 404);
  }

  const alertResult = await query(
    `INSERT INTO crisis_alerts (user_id, alert_type, severity_level, description, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, 'counselor_reported', severity, description, reporterId]
  );

  const newAlert = alertResult.rows[0];

  // Emit a real-time notification to admins
  io.emit('newCrisisAlert', {
    id: newAlert.id,
    userId: newAlert.user_id,
    description: newAlert.description,
    severity: newAlert.severity_level,
    timestamp: newAlert.created_at,
    reporterId: newAlert.created_by,
  });

  res.status(201).json({
    success: true,
    message: 'Crisis alert reported for user successfully',
    alert: newAlert,
  });
}));

export default router;
