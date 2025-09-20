import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole, requireSameInstitution } from '../middleware/auth';

const router = express.Router();

// Get dashboard overview (admin only)
router.get('/dashboard', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const institutionId = req.user!.institution_id;

  // Build institution filter
  let institutionFilter = '';
  const values = [];
  let paramCount = 1;

  if (userRole === 'college_admin' && institutionId) {
    institutionFilter = `WHERE u.institution_id = $${paramCount++}`;
    values.push(institutionId);
  }

  // Get user statistics
  const userStatsResult = await query(
    `SELECT 
       COUNT(*) as total_users,
       COUNT(CASE WHEN u.role = 'student' THEN 1 END) as students,
       COUNT(CASE WHEN u.role = 'counselor' THEN 1 END) as counselors,
       COUNT(CASE WHEN u.role = 'volunteer' THEN 1 END) as volunteers,
       COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_users
     FROM users u
     ${institutionFilter}`,
    values
  );

  // Get appointment statistics
  const appointmentStatsResult = await query(
    `SELECT 
       COUNT(*) as total_appointments,
       COUNT(CASE WHEN a.status = 'scheduled' THEN 1 END) as scheduled,
       COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled
     FROM appointments a
     JOIN users u ON a.student_id = u.id
     ${institutionFilter}`,
    values
  );

  // Get crisis alert statistics
  const crisisStatsResult = await query(
    `SELECT 
       COUNT(*) as total_alerts,
       COUNT(CASE WHEN ca.status = 'active' THEN 1 END) as active_alerts,
       COUNT(CASE WHEN ca.severity_level >= 8 THEN 1 END) as high_severity
     FROM crisis_alerts ca
     JOIN users u ON ca.user_id = u.id
     ${institutionFilter}`,
    values
  );

  // Get recent activity
  const recentActivityResult = await query(
    `SELECT 
       'appointment' as type,
       a.id as item_id,
       a.status as status,
       a.created_at as created_at,
       s.first_name || ' ' || s.last_name as student_name,
       c.first_name || ' ' || c.last_name as counselor_name
     FROM appointments a
     JOIN users s ON a.student_id = s.id
     JOIN users c ON a.counselor_id = c.id
     ${institutionFilter}
     UNION ALL
     SELECT 
       'crisis_alert' as type,
       ca.id as item_id,
       ca.status as status,
       ca.created_at as created_at,
       u.first_name || ' ' || u.last_name as student_name,
       NULL as counselor_name
     FROM crisis_alerts ca
     JOIN users u ON ca.user_id = u.id
     ${institutionFilter}
     ORDER BY created_at DESC
     LIMIT 10`,
    values
  );

  res.json({
    success: true,
    dashboard: {
      userStats: userStatsResult.rows[0],
      appointmentStats: appointmentStatsResult.rows[0],
      crisisStats: crisisStatsResult.rows[0],
      recentActivity: recentActivityResult.rows
    }
  });
}));

// Get crisis alerts (admin/counselor only)
router.get('/crisis-alerts', requireRole(['counselor', 'college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, severity, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = '';
  const values = [];
  let paramCount = 1;

  if (status) {
    whereClause += `WHERE ca.status = $${paramCount++}`;
    values.push(String(status));
  }

  if (severity) {
    const condition = whereClause ? 'AND' : 'WHERE';
    whereClause += ` ${condition} ca.severity_level >= $${paramCount++}`;
    values.push(Number(severity));
  }

  const alertsResult = await query(
    `SELECT ca.*, u.first_name, u.last_name, u.email, u.phone
     FROM crisis_alerts ca
     JOIN users u ON ca.user_id = u.id
     ${whereClause}
     ORDER BY ca.created_at DESC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM crisis_alerts ca ${whereClause}`,
    values
  );

  res.json({
    success: true,
    alerts: alertsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Update crisis alert status
router.patch('/crisis-alerts/:alertId', requireRole(['counselor', 'college_admin', 'ngo_admin']), [
  body('status').isIn(['active', 'acknowledged', 'resolved', 'false_positive']),
  body('resolutionNotes').optional().isLength({ max: 1000 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { alertId } = req.params;
  const { status, resolutionNotes } = req.body;
  const userId = req.user!.id;

  // Verify alert exists
  const alertResult = await query(
    'SELECT * FROM crisis_alerts WHERE id = $1',
    [alertId]
  );

  if (alertResult.rows.length === 0) {
    throw new CustomError('Crisis alert not found', 404);
  }

  // Update alert
  const updateFields = ['status = $1', 'assigned_counselor_id = $2'];
  const values = [status, userId];
  let paramCount = 3;

  if (resolutionNotes) {
    updateFields.push(`resolution_notes = $${paramCount++}`);
    values.push(resolutionNotes);
  }

  if (status === 'resolved') {
    updateFields.push(`resolved_at = CURRENT_TIMESTAMP`);
  }

  values.push(alertId);
  const queryText = `UPDATE crisis_alerts SET ${updateFields.join(', ')} WHERE id = $${paramCount}`;

  await query(queryText, values);

  res.json({
    success: true,
    message: 'Crisis alert updated successfully'
  });
}));

// Get institutions (admin only)
router.get('/institutions', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionsResult = await query(
    'SELECT * FROM institutions WHERE is_active = true ORDER BY name'
  );

  res.json({
    success: true,
    institutions: institutionsResult.rows
  });
}));

// Create institution (admin only)
router.post('/institutions', requireRole(['college_admin', 'ngo_admin']), [
  body('name').isLength({ min: 1, max: 255 }),
  body('type').isIn(['college', 'ngo']),
  body('domain').optional().isLength({ max: 255 }),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional().isLength({ max: 20 }),
  body('address').optional().isLength({ max: 500 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { name, type, domain, contactEmail, contactPhone, address } = req.body;

  const institutionResult = await query(
    `INSERT INTO institutions (name, type, domain, contact_email, contact_phone, address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, type, domain, contactEmail, contactPhone, address]
  );

  res.status(201).json({
    success: true,
    institution: institutionResult.rows[0]
  });
}));

// Update institution (admin only)
router.put('/institutions/:institutionId', requireRole(['college_admin', 'ngo_admin']), [
  body('name').optional().isLength({ min: 1, max: 255 }),
  body('type').optional().isIn(['college', 'ngo']),
  body('domain').optional().isLength({ max: 255 }),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional().isLength({ max: 20 }),
  body('address').optional().isLength({ max: 500 }),
  body('isActive').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { institutionId } = req.params;
  const { name, type, domain, contactEmail, contactPhone, address, isActive } = req.body;

  // Verify institution exists
  const institutionResult = await query(
    'SELECT * FROM institutions WHERE id = $1',
    [institutionId]
  );

  if (institutionResult.rows.length === 0) {
    throw new CustomError('Institution not found', 404);
  }

  // Build update query
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  if (name) {
    updateFields.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (type) {
    updateFields.push(`type = $${paramCount++}`);
    values.push(type);
  }
  if (domain) {
    updateFields.push(`domain = $${paramCount++}`);
    values.push(domain);
  }
  if (contactEmail) {
    updateFields.push(`contact_email = $${paramCount++}`);
    values.push(contactEmail);
  }
  if (contactPhone) {
    updateFields.push(`contact_phone = $${paramCount++}`);
    values.push(contactPhone);
  }
  if (address) {
    updateFields.push(`address = $${paramCount++}`);
    values.push(address);
  }
  if (isActive !== undefined) {
    updateFields.push(`is_active = $${paramCount++}`);
    values.push(isActive);
  }

  if (updateFields.length === 0) {
    throw new CustomError('No fields to update', 400);
  }

  values.push(institutionId);
  const queryText = `UPDATE institutions SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount}`;

  await query(queryText, values);

  res.json({
    success: true,
    message: 'Institution updated successfully'
  });
}));

// Get system logs (admin only)
router.get('/logs', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const logsResult = await query(
    `SELECT al.*, u.email as user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM audit_logs'
  );

  res.json({
    success: true,
    logs: logsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Get all counselors
router.get('/counselors', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const counselors = await query("SELECT id, first_name, last_name, email, is_active FROM users WHERE role = 'counselor'");
  res.json({ success: true, data: counselors.rows });
}));

// Add a new counselor
router.post('/counselors', requireRole(['college_admin', 'ngo_admin']), [
  body('email').isEmail(),
  body('firstName').isString().notEmpty(),
  body('lastName').isString().notEmpty(),
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, firstName, lastName } = req.body;
  const institutionId = req.user!.institution_id;

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ success: false, message: 'User with this email already exists' });
  }

  const newUser = await query(
    'INSERT INTO users (email, first_name, last_name, role, institution_id, is_verified) VALUES ($1, $2, $3, \'counselor\', $4, true) RETURNING id, first_name, last_name, email, is_active',
    [email, firstName, lastName, institutionId]
  );

  return res.status(201).json({ success: true, data: newUser.rows[0] });
}));

// Get all peer counselors
router.get('/peer-counselors', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const counselors = await query("SELECT id, first_name, last_name, email, is_active FROM users WHERE role = 'volunteer'");
  res.json({ success: true, data: counselors.rows });
}));

// Add a new peer counselor
router.post('/peer-counselors', requireRole(['college_admin', 'ngo_admin']), [
  body('email').isEmail(),
  body('firstName').isString().notEmpty(),
  body('lastName').isString().notEmpty(),
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, firstName, lastName } = req.body;
  const institutionId = req.user!.institution_id;

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ success: false, message: 'User with this email already exists' });
  }

  const newUser = await query(
    'INSERT INTO users (email, first_name, last_name, role, institution_id, is_verified) VALUES ($1, $2, $3, \'volunteer\', $4, true) RETURNING id, first_name, last_name, email, is_active',
    [email, firstName, lastName, institutionId]
  );

  return res.status(201).json({ success: true, data: newUser.rows[0] });
}));

// Get all forum threads
router.get('/forums', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const threadsResult = await query(
    `SELECT ft.*, fc.name as category_name, u.first_name, u.last_name
     FROM forum_threads ft
     JOIN forum_categories fc ON ft.category_id = fc.id
     LEFT JOIN users u ON ft.created_by = u.id
     ORDER BY ft.last_activity DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM forum_threads'
  );

  res.json({
    success: true,
    threads: threadsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Get all appointments
router.get('/appointments', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = '';
  const values = [];
  let paramCount = 1;

  if (status) {
    whereClause += `WHERE status = ${paramCount++}`;
    values.push(String(status));
  }

  const appointmentsResult = await query(
    `SELECT a.*, s.first_name as student_first_name, s.last_name as student_last_name, s.email as student_email,
            c.first_name as counselor_first_name, c.last_name as counselor_last_name, c.email as counselor_email
     FROM appointments a
     JOIN users s ON a.student_id = s.id
     JOIN users c ON a.counselor_id = c.id
     ${whereClause}
     ORDER BY a.scheduled_at DESC
     LIMIT ${paramCount++} OFFSET ${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM appointments ${whereClause}`,
    values
  );

  res.json({
    success: true,
    appointments: appointmentsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

export default router;
