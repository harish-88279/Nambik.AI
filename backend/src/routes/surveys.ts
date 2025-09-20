import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { assessMentalHealth } from '../services/aiService';
import { io } from '../services/socketService';

const router = express.Router();

// Get survey templates
router.get('/templates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const templatesResult = await query(
    'SELECT * FROM survey_templates WHERE is_active = true ORDER BY name'
  );

  res.json({
    success: true,
    templates: templatesResult.rows
  });
}));

// Get survey template by ID
router.get('/templates/:templateId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { templateId } = req.params;

  const templateResult = await query(
    'SELECT * FROM survey_templates WHERE id = $1 AND is_active = true',
    [templateId]
  );

  if (templateResult.rows.length === 0) {
    throw new CustomError('Survey template not found', 404);
  }

  res.json({
    success: true,
    template: templateResult.rows[0]
  });
}));

// Submit survey response
router.post('/submit', [
  body('templateId').isUUID(),
  body('responses').isObject(),
  body('isAnonymous').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const { templateId, responses, isAnonymous = true } = req.body;

  // Verify template exists
  const templateResult = await query(
    'SELECT * FROM survey_templates WHERE id = $1 AND is_active = true',
    [templateId]
  );

  if (templateResult.rows.length === 0) {
    throw new CustomError('Survey template not found', 404);
  }

  const template = templateResult.rows[0];

  // Calculate scores based on template type
  let totalScore = 0;
  let riskLevel = 'low';

  if (template.survey_type === 'phq9') {
    // PHQ-9 scoring (0-27)
    totalScore = Object.values(responses).reduce((sum: number, score: any) => sum + Number(score), 0);
    if (totalScore >= 20) riskLevel = 'severe';
    else if (totalScore >= 15) riskLevel = 'high';
    else if (totalScore >= 10) riskLevel = 'moderate';
  } else if (template.survey_type === 'gad7') {
    // GAD-7 scoring (0-21)
    totalScore = Object.values(responses).reduce((sum: number, score: any) => sum + Number(score), 0);
    if (totalScore >= 15) riskLevel = 'severe';
    else if (totalScore >= 10) riskLevel = 'high';
    else if (totalScore >= 5) riskLevel = 'moderate';
  }

  // Store survey response
  const surveyResult = await query(
    `INSERT INTO wellness_surveys (user_id, template_id, responses, total_score, risk_level, is_anonymous)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, templateId, responses, totalScore, riskLevel, isAnonymous]
  );

    const survey = surveyResult.rows[0];

  // Create crisis alert if high risk
  if (riskLevel === 'severe' || riskLevel === 'high') {
    const alertResult = await query(
      `INSERT INTO crisis_alerts (user_id, alert_type, severity_level, description, source_survey_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, 'survey_triggered', riskLevel === 'severe' ? 9 : 7, `High risk assessment: ${template.name}`, survey.id]
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
  }

  // Get recommendations
  const assessment = assessMentalHealth(responses);

  res.status(201).json({
    success: true,
    survey,
    assessment: {
      totalScore,
      riskLevel,
      recommendations: assessment.recommendations
    }
  });
}));

// Get user's survey history
router.get('/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const surveysResult = await query(
    `SELECT ws.*, st.name as template_name, st.survey_type
     FROM wellness_surveys ws
     JOIN survey_templates st ON ws.template_id = st.id
     WHERE ws.user_id = $1
     ORDER BY ws.completed_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, Number(limit), offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM wellness_surveys WHERE user_id = $1',
    [userId]
  );

  res.json({
    success: true,
    surveys: surveysResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Get survey by ID
router.get('/:surveyId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { surveyId } = req.params;
  const userId = req.user!.id;

  const surveyResult = await query(
    `SELECT ws.*, st.name as template_name, st.survey_type
     FROM wellness_surveys ws
     JOIN survey_templates st ON ws.template_id = st.id
     WHERE ws.id = $1 AND ws.user_id = $2`,
    [surveyId, userId]
  );

  if (surveyResult.rows.length === 0) {
    throw new CustomError('Survey not found', 404);
  }

  res.json({
    success: true,
    survey: surveyResult.rows[0]
  });
}));

// Get anonymized survey analytics (admin only)
router.get('/analytics/overview', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate, templateId } = req.query;

  let whereClause = 'WHERE ws.is_anonymous = true';
  const values = [];
  let paramCount = 1;

  if (startDate) {
    whereClause += ` AND ws.completed_at >= $${paramCount++}`;
    values.push(String(startDate));
  }

  if (endDate) {
    whereClause += ` AND ws.completed_at <= $${paramCount++}`;
    values.push(String(endDate));
  }

  if (templateId) {
    whereClause += ` AND ws.template_id = $${paramCount++}`;
    values.push(String(templateId));
  }

  // Get overall statistics
  const statsResult = await query(
    `SELECT 
       COUNT(*) as total_surveys,
       AVG(ws.total_score) as average_score,
       COUNT(CASE WHEN ws.risk_level = 'severe' THEN 1 END) as severe_count,
       COUNT(CASE WHEN ws.risk_level = 'high' THEN 1 END) as high_count,
       COUNT(CASE WHEN ws.risk_level = 'moderate' THEN 1 END) as moderate_count,
       COUNT(CASE WHEN ws.risk_level = 'low' THEN 1 END) as low_count
     FROM wellness_surveys ws
     ${whereClause}`,
    values
  );

  // Get trends over time
  const trendsResult = await query(
    `SELECT 
       DATE(ws.completed_at) as date,
       COUNT(*) as survey_count,
       AVG(ws.total_score) as average_score
     FROM wellness_surveys ws
     ${whereClause}
     GROUP BY DATE(ws.completed_at)
     ORDER BY date DESC
     LIMIT 30`,
    values
  );

  // Get risk level distribution
  const riskDistributionResult = await query(
    `SELECT 
       ws.risk_level,
       COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
     FROM wellness_surveys ws
     ${whereClause}
     GROUP BY ws.risk_level
     ORDER BY 
       CASE ws.risk_level 
         WHEN 'severe' THEN 1 
         WHEN 'high' THEN 2 
         WHEN 'moderate' THEN 3 
         WHEN 'low' THEN 4 
       END`,
    values
  );

  res.json({
    success: true,
    analytics: {
      overview: statsResult.rows[0],
      trends: trendsResult.rows,
      riskDistribution: riskDistributionResult.rows
    }
  });
}));

// Create survey template (admin only)
router.post('/templates', requireRole(['college_admin', 'ngo_admin']), [
  body('name').isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('surveyType').isIn(['phq9', 'gad7', 'custom']),
  body('questions').isObject()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { name, description, surveyType, questions } = req.body;

  const templateResult = await query(
    `INSERT INTO survey_templates (name, description, survey_type, questions)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, description, surveyType, questions]
  );

  res.status(201).json({
    success: true,
    template: templateResult.rows[0]
  });
}));

// Update survey template (admin only)
router.put('/templates/:templateId', requireRole(['college_admin', 'ngo_admin']), [
  body('name').optional().isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('questions').optional().isObject(),
  body('isActive').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { templateId } = req.params;
  const { name, description, questions, isActive } = req.body;

  // Verify template exists
  const templateResult = await query(
    'SELECT * FROM survey_templates WHERE id = $1',
    [templateId]
  );

  if (templateResult.rows.length === 0) {
    throw new CustomError('Survey template not found', 404);
  }

  // Build update query
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  if (name) {
    updateFields.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (description) {
    updateFields.push(`description = $${paramCount++}`);
    values.push(description);
  }
  if (questions) {
    updateFields.push(`questions = $${paramCount++}`);
    values.push(questions);
  }
  if (isActive !== undefined) {
    updateFields.push(`is_active = $${paramCount++}`);
    values.push(isActive);
  }

  if (updateFields.length === 0) {
    throw new CustomError('No fields to update', 400);
  }

  values.push(templateId);
  const queryText = `UPDATE survey_templates SET ${updateFields.join(', ')} WHERE id = $${paramCount}`;

  await query(queryText, values);

  res.json({
    success: true,
    message: 'Survey template updated successfully'
  });
}));

export default router;
