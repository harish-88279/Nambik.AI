import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = Router();

// Submit feedback
router.post('/', [
  body('receiverId').isUUID(),
  body('appointmentId').optional().isUUID(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comments').optional().isLength({ max: 1000 }),
] , asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const senderId = req.user!.id;
  const { receiverId, appointmentId, rating, comments } = req.body;

  // Verify receiver exists
  const receiverExists = await query('SELECT id FROM users WHERE id = $1', [receiverId]);
  if (receiverExists.rows.length === 0) {
    throw new CustomError('Receiver not found', 404);
  }

  // Verify appointment exists if provided
  if (appointmentId) {
    const appointmentExists = await query('SELECT id FROM appointments WHERE id = $1', [appointmentId]);
    if (appointmentExists.rows.length === 0) {
      throw new CustomError('Appointment not found', 404);
    }
  }

  const feedbackResult = await query(
    `INSERT INTO feedback (sender_id, receiver_id, appointment_id, rating, comments)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [senderId, receiverId, appointmentId, rating, comments]
  );

  res.status(201).json({
    success: true,
    message: 'Feedback submitted successfully',
    feedback: feedbackResult.rows[0],
  });
}));

// Get feedback (admin/counselor only)
router.get('/', requireRole(['college_admin', 'ngo_admin', 'counselor']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, receiverId, senderId } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = '';
  const values = [];
  let paramCount = 1;

  // Filter by receiver (e.g., counselor viewing feedback for themselves)
  if (receiverId) {
    whereClause += `WHERE f.receiver_id = $${paramCount++}`;
    values.push(String(receiverId));
  }

  // Filter by sender (e.g., admin viewing feedback sent by a specific user)
  if (senderId) {
    const condition = whereClause ? 'AND' : 'WHERE';
    whereClause += ` ${condition} f.sender_id = $${paramCount++}`;
    values.push(String(senderId));
  }

  const feedbackResult = await query(
    `SELECT f.*, 
            s.first_name as sender_first_name, s.last_name as sender_last_name, s.email as sender_email,
            r.first_name as receiver_first_name, r.last_name as receiver_last_name, r.email as receiver_email
     FROM feedback f
     JOIN users s ON f.sender_id = s.id
     JOIN users r ON f.receiver_id = r.id
     ${whereClause}
     ORDER BY f.created_at DESC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM feedback f ${whereClause}`,
    values
  );

  res.json({
    success: true,
    feedback: feedbackResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

export default router;
