import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole, requireSameInstitution } from '../middleware/auth';

const router = express.Router();

// Get appointments for current user
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = '';
  const values = [userId];
  let paramCount = 2;

  if (userRole === 'student') {
    whereClause = 'WHERE a.student_id = $1';
  } else if (userRole === 'counselor') {
    whereClause = 'WHERE a.counselor_id = $1';
  } else if (['college_admin', 'ngo_admin'].includes(userRole)) {
    // Admin can see all appointments
    whereClause = 'WHERE 1=1';
    // Remove userId binding for admin to avoid unused parameter
    values.pop();
    paramCount = 1;
  } else {
    whereClause = 'WHERE (a.student_id = $1 OR a.counselor_id = $1)';
  }

  if (status) {
    whereClause += ` AND a.status = $${paramCount++}`;
    values.push(String(status));
  }

  const appointmentsResult = await query(
    `SELECT a.*, 
            s.first_name as student_first_name, s.last_name as student_last_name, s.email as student_email,
            c.first_name as counselor_first_name, c.last_name as counselor_last_name, c.email as counselor_email
     FROM appointments a
     JOIN users s ON a.student_id = s.id
     JOIN users c ON a.counselor_id = c.id
     ${whereClause}
     ORDER BY a.scheduled_at DESC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM appointments a ${whereClause}`,
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

// Create new appointment
router.post('/', [
  body('counselorId').isUUID(),
  body('appointmentType').isIn(['virtual', 'in_person']),
  body('scheduledAt').isISO8601(),
  body('durationMinutes').optional().isInt({ min: 15, max: 180 }),
  body('studentNotes').optional().isLength({ max: 1000 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const { counselorId, appointmentType, scheduledAt, durationMinutes = 60, studentNotes } = req.body;

  // Verify user is a student
  if (req.user!.role !== 'student') {
    throw new CustomError('Only students can book appointments', 403);
  }

  // Verify counselor exists and is active
  const counselorResult = await query(
    'SELECT * FROM users WHERE id = $1 AND role = $2 AND is_active = true',
    [counselorId, 'counselor']
  );

  if (counselorResult.rows.length === 0) {
    throw new CustomError('Counselor not found or inactive', 404);
  }

  // Load counselor slot size
  const settingsResult = await query(
    'SELECT slot_minutes FROM counselor_settings WHERE counselor_id = $1',
    [counselorId]
  );
  const slotMinutes = settingsResult.rows[0]?.slot_minutes || 60;

  // Validate scheduledAt aligns with slot boundaries (IST)
  const scheduled = new Date(scheduledAt);
  if (isNaN(scheduled.getTime())) {
    throw new CustomError('Invalid scheduledAt', 400);
  }
  const minutes = scheduled.getUTCMinutes();
  if (minutes % slotMinutes !== 0) {
    throw new CustomError(`Time must align to ${slotMinutes}-minute slots`, 400);
  }

  // Validate against availability windows (IST weekdays/time)
  const weekday = (scheduled.getUTCDay()); // 0-6
  const hh = String(scheduled.getUTCHours()).padStart(2, '0');
  const mm = String(scheduled.getUTCMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}:00`;

  const windowsResult = await query(
    `SELECT 1 FROM counselor_availability_windows 
     WHERE counselor_id = $1 AND weekday = $2 AND is_active = true
       AND start_time <= $3::time AND end_time > $3::time`,
    [counselorId, weekday, timeStr]
  );
  if (windowsResult.rows.length === 0) {
    throw new CustomError('Selected time is outside counselor availability', 409);
  }

  // Check time off window conflicts
  const endAt = new Date(scheduled.getTime() + slotMinutes * 60000);
  const timeOffResult = await query(
    `SELECT 1 FROM counselor_time_off
     WHERE counselor_id = $1 AND NOT ($3 <= start_at OR $2 >= end_at)`,
    [counselorId, scheduled.toISOString(), endAt.toISOString()]
  );
  if (timeOffResult.rows.length > 0) {
    throw new CustomError('Counselor is on time-off during this slot', 409);
  }

  // Check for conflicting appointments (overlap) - counselor side
  const counselorConflictResult = await query(
    `SELECT 1 FROM appointments 
     WHERE counselor_id = $1 
       AND status IN ('scheduled', 'confirmed')
       AND NOT ($3 <= scheduled_at OR $2 >= scheduled_at + (duration_minutes || ' minutes')::interval)`,
    [counselorId, scheduled.toISOString(), endAt.toISOString()]
  );

  if (counselorConflictResult.rows.length > 0) {
    throw new CustomError('Counselor is not available at this time', 409);
  }

  // Also prevent the student from double-booking overlapping appointments
  const studentConflictResult = await query(
    `SELECT 1 FROM appointments 
     WHERE student_id = $1 
       AND status IN ('scheduled', 'confirmed')
       AND NOT ($3 <= scheduled_at OR $2 >= scheduled_at + (duration_minutes || ' minutes')::interval)`,
    [userId, scheduled.toISOString(), endAt.toISOString()]
  );

  if (studentConflictResult.rows.length > 0) {
    throw new CustomError('You already have an appointment overlapping this time', 409);
  }

  // Create appointment
  const appointmentResult = await query(
    `INSERT INTO appointments (student_id, counselor_id, appointment_type, scheduled_at, duration_minutes, student_notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, counselorId, appointmentType, scheduledAt, durationMinutes, studentNotes]
  );

  const appointment = appointmentResult.rows[0];

  // Create a chat session for the appointment
  const chatSessionResult = await query(
    `INSERT INTO chat_sessions (user_id, counselor_id, session_type)
     VALUES ($1, $2, 'counselor_chat')
     RETURNING id`,
    [userId, counselorId]
  );

  const chatSessionId = chatSessionResult.rows[0].id;

  res.status(201).json({
    success: true,
    appointment,
    chatSessionId,
  });
}));

// Get appointment by ID
router.get('/:appointmentId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { appointmentId } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const appointmentResult = await query(
    `SELECT a.*, 
            s.first_name as student_first_name, s.last_name as student_last_name, s.email as student_email,
            c.first_name as counselor_first_name, c.last_name as counselor_last_name, c.email as counselor_email
     FROM appointments a
     JOIN users s ON a.student_id = s.id
     JOIN users c ON a.counselor_id = c.id
     WHERE a.id = $1`,
    [appointmentId]
  );

  if (appointmentResult.rows.length === 0) {
    throw new CustomError('Appointment not found', 404);
  }

  const appointment = appointmentResult.rows[0];

  // Check if user has access to this appointment
  if (userRole === 'student' && appointment.student_id !== userId) {
    throw new CustomError('Access denied', 403);
  }
  if (userRole === 'counselor' && appointment.counselor_id !== userId) {
    throw new CustomError('Access denied', 403);
  }

  res.json({
    success: true,
    appointment
  });
}));

// Update appointment status
router.patch('/:appointmentId/status', [
  body('status').isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  body('notes').optional().isLength({ max: 1000 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { appointmentId } = req.params;
  const { status, notes } = req.body;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  // Get appointment
  const appointmentResult = await query(
    'SELECT * FROM appointments WHERE id = $1',
    [appointmentId]
  );

  if (appointmentResult.rows.length === 0) {
    throw new CustomError('Appointment not found', 404);
  }

  const appointment = appointmentResult.rows[0];

  // Check permissions
  const canUpdate = userRole === 'counselor' && appointment.counselor_id === userId ||
                   userRole === 'student' && appointment.student_id === userId ||
                   ['college_admin', 'ngo_admin'].includes(userRole);

  if (!canUpdate) {
    throw new CustomError('Access denied', 403);
  }

  // Update appointment
  const updateFields = ['status = $1'];
  const values = [status];
  let paramCount = 2;

  if (notes && userRole === 'counselor') {
    updateFields.push(`notes = $${paramCount++}`);
    values.push(notes);
  }

  values.push(appointmentId);
  const queryText = `UPDATE appointments SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount}`;

  await query(queryText, values);

  res.json({
    success: true,
    message: 'Appointment status updated successfully'
  });
}));

// Cancel appointment
router.patch('/:appointmentId/cancel', [
  body('reason').optional().isLength({ max: 500 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { appointmentId } = req.params;
  const { reason } = req.body;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  // Get appointment
  const appointmentResult = await query(
    'SELECT * FROM appointments WHERE id = $1',
    [appointmentId]
  );

  if (appointmentResult.rows.length === 0) {
    throw new CustomError('Appointment not found', 404);
  }

  const appointment = appointmentResult.rows[0];

  // Check if appointment can be cancelled
  if (['completed', 'cancelled'].includes(appointment.status)) {
    throw new CustomError('Appointment cannot be cancelled', 400);
  }

  // Check permissions
  const canCancel = userRole === 'student' && appointment.student_id === userId ||
                   userRole === 'counselor' && appointment.counselor_id === userId ||
                   ['college_admin', 'ngo_admin'].includes(userRole);

  if (!canCancel) {
    throw new CustomError('Access denied', 403);
  }

  // Cancel appointment
  await query(
    'UPDATE appointments SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    ['cancelled', reason || 'Cancelled by user', appointmentId]
  );

  res.json({
    success: true,
    message: 'Appointment cancelled successfully'
  });
}));

// Get available counselors (consult availability + conflicts)
router.get('/counselors/available', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date, time } = req.query; // date: YYYY-MM-DD, time: HH:mm (IST)

  // Date is optional: if provided with 'time', we'll filter by availability; otherwise return all verified counselors

  const counselorsResult = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, cp.specialization, cp.languages_spoken, cp.bio
     FROM users u
     JOIN counselor_profiles cp ON u.id = cp.user_id
     WHERE u.role = 'counselor' AND u.is_active = true AND cp.is_verified = true
     ORDER BY u.first_name, u.last_name`
  );

  const availableCounselors: any[] = [];
  for (const counselor of counselorsResult.rows) {
    if (time) {
      const dt = new Date(`${date}T${time}:00.000Z`); // treated as IST by client; backend uses UTC consistently
      const weekday = dt.getUTCDay();
      const hh = String(dt.getUTCHours()).padStart(2, '0');
      const mm = String(dt.getUTCMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}:00`;

      const windowOk = await query(
        `SELECT 1 FROM counselor_availability_windows
         WHERE counselor_id = $1 AND weekday = $2 AND is_active = true
           AND start_time <= $3::time AND end_time > $3::time`,
        [counselor.id, weekday, timeStr]
      );
      if (windowOk.rows.length === 0) continue;

      const settingsResult = await query(
        'SELECT slot_minutes FROM counselor_settings WHERE counselor_id = $1',
        [counselor.id]
      );
      const slotMinutes = settingsResult.rows[0]?.slot_minutes || 60;
      const endAt = new Date(dt.getTime() + slotMinutes * 60000);

      const conflictResult = await query(
        `SELECT 1 FROM appointments 
         WHERE counselor_id = $1 AND status IN ('scheduled','confirmed')
           AND NOT ($3 <= scheduled_at OR $2 >= scheduled_at + (duration_minutes || ' minutes')::interval)`,
        [counselor.id, dt.toISOString(), endAt.toISOString()]
      );
      if (conflictResult.rows.length > 0) continue;

      const timeOffResult = await query(
        `SELECT 1 FROM counselor_time_off
         WHERE counselor_id = $1 AND NOT ($3 <= start_at OR $2 >= end_at)`,
        [counselor.id, dt.toISOString(), endAt.toISOString()]
      );
      if (timeOffResult.rows.length > 0) continue;

      availableCounselors.push(counselor);
    } else {
      availableCounselors.push(counselor);
    }
  }

  res.json({ success: true, counselors: availableCounselors });
}));

// Get available slots for a counselor within a date range
router.get('/counselors/:counselorId/available-slots', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { counselorId } = req.params;
  const { from, to, slotMinutes } = req.query as { from?: string; to?: string; slotMinutes?: string };

  if (!from || !to) {
    throw new CustomError('from and to are required (YYYY-MM-DD)', 400);
  }

  const settingsResult = await query(
    'SELECT slot_minutes FROM counselor_settings WHERE counselor_id = $1',
    [counselorId]
  );
  const slotSize = Number(slotMinutes) || settingsResult.rows[0]?.slot_minutes || 60;

  // Load weekly windows
  const windowsResult = await query(
    `SELECT weekday, start_time, end_time FROM counselor_availability_windows
     WHERE counselor_id = $1 AND is_active = true`,
    [counselorId]
  );
  const windowsByDay = new Map<number, { start: string; end: string }[]>();
  for (const row of windowsResult.rows) {
    const list = windowsByDay.get(row.weekday) || [];
    list.push({ start: row.start_time, end: row.end_time });
    windowsByDay.set(row.weekday, list);
  }

  // Load time off and appointments in range
  const fromStart = new Date(`${from}T00:00:00.000Z`);
  const toEnd = new Date(`${to}T23:59:59.999Z`);

  const timeOff = await query(
    `SELECT start_at, end_at FROM counselor_time_off
     WHERE counselor_id = $1 AND NOT ($3 <= start_at OR $2 >= end_at)`,
    [counselorId, fromStart.toISOString(), toEnd.toISOString()]
  );

  const appts = await query(
    `SELECT scheduled_at, duration_minutes FROM appointments
     WHERE counselor_id = $1 AND status IN ('scheduled','confirmed')
       AND scheduled_at BETWEEN $2 AND $3`,
    [counselorId, fromStart.toISOString(), toEnd.toISOString()]
  );

  function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return !(aEnd <= bStart || aStart >= bEnd);
  }

  const slots: string[] = [];
  for (let d = new Date(fromStart); d <= toEnd; d = new Date(d.getTime() + 24*60*60*1000)) {
    const weekday = d.getUTCDay();
    const dayWindows = windowsByDay.get(weekday) || [];
    for (const w of dayWindows) {
      // Build day slot times
      const [sh, sm] = String(w.start).split(':').map(Number);
      const [eh, em] = String(w.end).split(':').map(Number);
      let cursor = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sh, sm, 0));
      const windowEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), eh, em, 0));
      while (cursor < windowEnd) {
        const end = new Date(cursor.getTime() + slotSize * 60000);
        if (end > windowEnd) break;

        // Check time-off
        let blocked = false;
        for (const t of timeOff.rows) {
          const ts = new Date(t.start_at);
          const te = new Date(t.end_at);
          if (overlaps(cursor, end, ts, te)) { blocked = true; break; }
        }
        if (blocked) { cursor = end; continue; }

        // Check appointments
        for (const a of appts.rows) {
          const as = new Date(a.scheduled_at);
          const ae = new Date(as.getTime() + (a.duration_minutes || 60) * 60000);
          if (overlaps(cursor, end, as, ae)) { blocked = true; break; }
        }
        if (!blocked) slots.push(cursor.toISOString());

        cursor = end;
      }
    }
  }

  res.json({ success: true, slotMinutes: slotSize, slots });
}));

export default router;
