import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = express.Router();

// Get resource categories
router.get('/categories', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const categoriesResult = await query(
    'SELECT * FROM resource_categories ORDER BY name'
  );

  res.json({
    success: true,
    categories: categoriesResult.rows
  });
}));

// Get distinct resource languages
router.get('/languages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const languagesResult = await query(
    `SELECT DISTINCT language FROM resources WHERE language IS NOT NULL AND language <> '' ORDER BY language`
  );

  res.json({
    success: true,
    languages: (languagesResult.rows as { language: string }[]).map((r) => r.language)
  });
}));

// Get resources
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { categoryId, language, resourceType, featured, tag, videoOnly, page = 1, limit = 20 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = 'WHERE 1=1';
  if (req.user?.role !== 'college_admin' && req.user?.role !== 'ngo_admin') {
    whereClause += ' AND r.is_published = true';
  }
  const values: any[] = [];
  let paramCount = 1;

  if (categoryId) {
    whereClause += ` AND r.category_id = $${paramCount++}`;
    values.push(String(categoryId));
  }

  if (language) {
    whereClause += ` AND r.language = $${paramCount++}`;
    values.push(String(language));
  }

  if (resourceType) {
    whereClause += ` AND r.resource_type = $${paramCount++}`;
    values.push(String(resourceType));
  }

  if (videoOnly === 'true') {
    whereClause += ` AND r.resource_type = 'video'`;
  }

  if (tag) {
    whereClause += ` AND $${paramCount++} = ANY(r.tags)`;
    values.push(String(tag));
  }

  if (featured === 'true') {
    whereClause += ` AND r.is_featured = true`;
  }

  const resourcesResult = await query(
    `SELECT r.*, rc.name as category_name, u.first_name as created_by_name
     FROM resources r
     LEFT JOIN resource_categories rc ON r.category_id = rc.id
     LEFT JOIN users u ON r.created_by = u.id
     ${whereClause}
     ORDER BY r.is_featured DESC, r.created_at DESC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM resources r ${whereClause}`,
    values
  );

  res.json({
    success: true,
    resources: resourcesResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Get resource by ID
router.get('/:resourceId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { resourceId } = req.params;

  const resourceResult = await query(
    `SELECT r.*, rc.name as category_name, u.first_name as created_by_name
     FROM resources r
     LEFT JOIN resource_categories rc ON r.category_id = rc.id
     LEFT JOIN users u ON r.created_by = u.id
     WHERE r.id = $1 AND r.is_published = true`,
    [resourceId]
  );

  if (resourceResult.rows.length === 0) {
    throw new CustomError('Resource not found', 404);
  }

  const resource = resourceResult.rows[0];

  // Increment view count
  await query(
    'UPDATE resources SET view_count = view_count + 1 WHERE id = $1',
    [resourceId]
  );

  res.json({
    success: true,
    resource
  });
}));

// Create new resource (admin only)
router.post('/', requireRole(['college_admin', 'ngo_admin']), [
  body('title').isLength({ min: 1, max: 255 }),
  body('description').isLength({ min: 1, max: 1000 }),
  body('content').optional().isLength({ max: 10000 }),
  body('resourceType').isIn(['article', 'video', 'audio', 'document', 'link']),
  body('categoryId').isUUID(),
  body('language').optional().isLength({ min: 2, max: 10 }),
  body('tags').optional().isArray()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const {
    title,
    description,
    content,
    resourceType,
    categoryId,
    language = 'en',
    fileUrl,
    thumbnailUrl,
    durationMinutes,
    tags = [],
    isFeatured = false
  } = req.body;

  // Verify category exists
  const categoryResult = await query(
    'SELECT * FROM resource_categories WHERE id = $1',
    [categoryId]
  );

  if (categoryResult.rows.length === 0) {
    throw new CustomError('Category not found', 404);
  }

  // Create resource
  const resourceResult = await query(
    `INSERT INTO resources (title, description, content, resource_type, category_id, language, 
                           file_url, thumbnail_url, duration_minutes, tags, is_featured, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [title, description, content, resourceType, categoryId, language, fileUrl, thumbnailUrl, durationMinutes, tags, isFeatured, userId]
  );

  res.status(201).json({
    success: true,
    resource: resourceResult.rows[0]
  });
}));

// Update resource (admin only)
router.put('/:resourceId', requireRole(['college_admin', 'ngo_admin']), [
  body('title').optional().isLength({ min: 1, max: 255 }),
  body('description').optional().isLength({ min: 1, max: 1000 }),
  body('content').optional().isLength({ max: 10000 }),
  body('resourceType').optional().isIn(['article', 'video', 'audio', 'document', 'link']),
  body('categoryId').optional().isUUID(),
  body('language').optional().isLength({ min: 2, max: 10 }),
  body('tags').optional().isArray()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { resourceId } = req.params;
  const {
    title,
    description,
    content,
    resourceType,
    categoryId,
    language,
    fileUrl,
    thumbnailUrl,
    durationMinutes,
    tags,
    isFeatured,
    isPublished
  } = req.body;

  // Verify resource exists
  const resourceResult = await query(
    'SELECT * FROM resources WHERE id = $1',
    [resourceId]
  );

  if (resourceResult.rows.length === 0) {
    throw new CustomError('Resource not found', 404);
  }

  // Build update query
  const updateFields = [];
  const values = [];
  let paramCount = 1;

  if (title) {
    updateFields.push(`title = $${paramCount++}`);
    values.push(title);
  }
  if (description) {
    updateFields.push(`description = $${paramCount++}`);
    values.push(description);
  }
  if (content !== undefined) {
    updateFields.push(`content = $${paramCount++}`);
    values.push(content);
  }
  if (resourceType) {
    updateFields.push(`resource_type = $${paramCount++}`);
    values.push(resourceType);
  }
  if (categoryId) {
    updateFields.push(`category_id = $${paramCount++}`);
    values.push(categoryId);
  }
  if (language) {
    updateFields.push(`language = $${paramCount++}`);
    values.push(language);
  }
  if (fileUrl) {
    updateFields.push(`file_url = $${paramCount++}`);
    values.push(fileUrl);
  }
  if (thumbnailUrl) {
    updateFields.push(`thumbnail_url = $${paramCount++}`);
    values.push(thumbnailUrl);
  }
  if (durationMinutes) {
    updateFields.push(`duration_minutes = $${paramCount++}`);
    values.push(durationMinutes);
  }
  if (tags) {
    updateFields.push(`tags = $${paramCount++}`);
    values.push(tags);
  }
  if (isFeatured !== undefined) {
    updateFields.push(`is_featured = $${paramCount++}`);
    values.push(isFeatured);
  }
  if (isPublished !== undefined) {
    updateFields.push(`is_published = $${paramCount++}`);
    values.push(isPublished);
  }

  if (updateFields.length === 0) {
    throw new CustomError('No fields to update', 400);
  }

  values.push(resourceId);
  const queryText = `UPDATE resources SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount}`;

  await query(queryText, values);

  res.json({
    success: true,
    message: 'Resource updated successfully'
  });
}));

// Delete resource (admin only)
router.delete('/:resourceId', requireRole(['college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { resourceId } = req.params;

  // Verify resource exists
  const resourceResult = await query(
    'SELECT * FROM resources WHERE id = $1',
    [resourceId]
  );

  if (resourceResult.rows.length === 0) {
    throw new CustomError('Resource not found', 404);
  }

  // Soft delete by unpublishing
  await query(
    'UPDATE resources SET is_published = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [resourceId]
  );

  res.json({
    success: true,
    message: 'Resource deleted successfully'
  });
}));

// Search resources
router.get('/search', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { q, categoryId, language, resourceType, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  if (!q || q.toString().trim().length < 2) {
    throw new CustomError('Search query must be at least 2 characters', 400);
  }

  let whereClause = 'WHERE r.is_published = true AND (r.title ILIKE $1 OR r.description ILIKE $1 OR r.content ILIKE $1)';
  const values = [`%${q}%`];
  let paramCount = 2;

  if (categoryId) {
    whereClause += ` AND r.category_id = $${paramCount++}`;
    values.push(String(categoryId));
  }

  if (language) {
    whereClause += ` AND r.language = $${paramCount++}`;
    values.push(String(language));
  }

  if (resourceType) {
    whereClause += ` AND r.resource_type = $${paramCount++}`;
    values.push(String(resourceType));
  }

  const resourcesResult = await query(
    `SELECT r.*, rc.name as category_name, u.first_name as created_by_name
     FROM resources r
     LEFT JOIN resource_categories rc ON r.category_id = rc.id
     LEFT JOIN users u ON r.created_by = u.id
     ${whereClause}
     ORDER BY r.is_featured DESC, r.view_count DESC, r.created_at DESC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM resources r ${whereClause}`,
    values
  );

  res.json({
    success: true,
    resources: resourcesResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

export default router;
