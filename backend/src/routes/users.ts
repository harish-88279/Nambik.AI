import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole, requireSameInstitution } from '../middleware/auth';
import { isMobilePhone } from 'validator';

const router = express.Router();

// Get user profile
router.get('/profile', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const userResult = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.institution_id,
            u.profile_picture_url, u.phone, u.date_of_birth, u.gender,
            u.preferred_language, u.created_at, u.last_login,
            i.name as institution_name, i.type as institution_type
     FROM users u
     LEFT JOIN institutions i ON u.institution_id = i.id
     WHERE u.id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new CustomError('User not found', 404);
  }

  const user = userResult.rows[0];

  // Get role-specific profile data
  let profileData = {};
  if (user.role === 'student') {
    const studentProfile = await query(
      'SELECT * FROM student_profiles WHERE user_id = $1',
      [userId]
    );
    profileData = studentProfile.rows[0] || {};
  } else if (user.role === 'counselor') {
    const counselorProfile = await query(
      'SELECT * FROM counselor_profiles WHERE user_id = $1',
      [userId]
    );
    profileData = counselorProfile.rows[0] || {};
  }

  res.json({
    success: true,
    user: {
      ...user,
      profile: profileData
    }
  });
}));

// Update user profile
router.put('/profile', [
  body('firstName').optional().isLength({ min: 1, max: 100 }),
  body('lastName').optional().isLength({ min: 1, max: 100 }),
  body('phone').optional().custom((value, { req }) => {
    if (value === '') {
      return true; // Allow empty string
    }
    // If not empty, validate as a mobile phone
    if (!isMobilePhone(value, 'any')) {
      throw new Error('Please fill a valid phone number or leave it empty.');
    }
    return true;
  }),
  body('preferredLanguage').optional().isLength({ min: 2, max: 10 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  logger.debug('Received profile update data:', req.body); // Add this line
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const { firstName, lastName, phone, preferredLanguage } = req.body;

  const updateFields = [];
  const values = [];
  let paramCount = 1;

  if (firstName) {
    updateFields.push(`first_name = $${paramCount}`);
    values.push(firstName);
    paramCount++;
  }
  if (lastName) {
    updateFields.push(`last_name = $${paramCount}`);
    values.push(lastName);
    paramCount++;
  }
  if (phone) {
    updateFields.push(`phone = $${paramCount}`);
    values.push(phone);
    paramCount++;
  }
  if (preferredLanguage) {
    updateFields.push(`preferred_language = $${paramCount}`);
    values.push(preferredLanguage);
    paramCount++;
  }

  if (updateFields.length === 0) {
    throw new CustomError('No fields to update', 400);
  }

  values.push(userId);
  const queryText = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount}`;

  await query(queryText, values);

  // Fetch the updated user to return the latest data
  const updatedUserResult = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.institution_id,
            u.profile_picture_url, u.phone, u.date_of_birth, u.gender,
            u.preferred_language, u.created_at, u.last_login,
            i.name as institution_name, i.type as institution_type
     FROM users u
     LEFT JOIN institutions i ON u.institution_id = i.id
     WHERE u.id = $1`,
    [userId]
  );

  if (updatedUserResult.rows.length === 0) {
    throw new CustomError('Updated user not found', 404); // Should not happen if update was successful
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: updatedUserResult.rows[0]
    }
  });
}));

// Get all users (admin only)
router.get('/', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { role, institution_id, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = 'WHERE u.is_active = true';
  const values = [];
  let paramCount = 1;

  // Filter by institution for non-super admins
  if (req.user!.role !== 'ngo_admin' && req.user!.institution_id) {
    whereClause += ` AND u.institution_id = $${paramCount++}`;
    values.push(req.user!.institution_id);
  }

  if (role) {
    whereClause += ` AND u.role = $${paramCount++}`;
    values.push(String(role));
  }

  if (institution_id) {
    whereClause += ` AND u.institution_id = $${paramCount++}`;
    values.push(String(institution_id));
  }

  const usersResult = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.institution_id,
            u.is_active, u.is_verified, u.created_at, u.last_login,
            i.name as institution_name
     FROM users u
     LEFT JOIN institutions i ON u.institution_id = i.id
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM users u ${whereClause}`,
    values
  );

  res.json({
    success: true,
    users: usersResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Get user by ID (admin only)
router.get('/:userId', requireRole(['college_admin', 'ngo_admin']), requireSameInstitution, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;

  const userResult = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.institution_id,
            u.profile_picture_url, u.phone, u.date_of_birth, u.gender,
            u.preferred_language, u.timezone, u.is_active, u.is_verified,
            u.created_at, u.last_login,
            i.name as institution_name, i.type as institution_type
     FROM users u
     LEFT JOIN institutions i ON u.institution_id = i.id
     WHERE u.id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new CustomError('User not found', 404);
  }

  const user = userResult.rows[0];

  // Get role-specific profile data
  let profileData = {};
  if (user.role === 'student') {
    const studentProfile = await query(
      'SELECT * FROM student_profiles WHERE user_id = $1',
      [userId]
    );
    profileData = studentProfile.rows[0] || {};
  } else if (user.role === 'counselor') {
    const counselorProfile = await query(
      'SELECT * FROM counselor_profiles WHERE user_id = $1',
      [userId]
    );
    profileData = counselorProfile.rows[0] || {};
  }

  res.json({
    success: true,
    user: {
      ...user,
      profile: profileData
    }
  });
}));

// Update user status (admin only)
router.patch('/:userId/status', requireRole(['college_admin', 'ngo_admin']), requireSameInstitution, [
  body('isActive').isBoolean(),
  body('isVerified').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { userId } = req.params;
  const { isActive, isVerified } = req.body;

  const updateFields = [];
  const values = [];
  let paramCount = 1;

  updateFields.push(`is_active = $${paramCount++}`);
  values.push(isActive);

  if (isVerified !== undefined) {
    updateFields.push(`is_verified = $${paramCount++}`);
    values.push(isVerified);
  }

  values.push(userId);
  const queryText = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount}`;

  await query(queryText, values);

  res.json({
    success: true,
    message: 'User status updated successfully'
  });
}));

// Delete user (admin only)
router.delete('/:userId', requireRole(['college_admin', 'ngo_admin']), requireSameInstitution, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;

  // Soft delete by deactivating
  await query(
    'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [userId]
  );

  res.json({
    success: true,
    message: 'User deactivated successfully'
  });
}));

export default router;
