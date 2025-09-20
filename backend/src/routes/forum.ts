import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';

const router = express.Router();

// Get forum categories
router.get('/categories', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const categoriesResult = await query(
    'SELECT * FROM forum_categories WHERE is_active = true ORDER BY name'
  );

  res.json({
    success: true,
    categories: categoriesResult.rows
  });
}));

// Get forum threads
router.get('/threads', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { categoryId, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = 'WHERE ft.is_locked = false';
  const values = [];
  let paramCount = 1;

  if (categoryId) {
    whereClause += ` AND ft.category_id = $${paramCount++}`;
    values.push(String(categoryId));
  }

  const threadsResult = await query(
    `SELECT ft.*, fc.name as category_name,
            COUNT(fp.id) as reply_count,
            MAX(fp.created_at) as last_activity
     FROM forum_threads ft
     LEFT JOIN forum_categories fc ON ft.category_id = fc.id
     LEFT JOIN forum_posts fp ON ft.id = fp.thread_id
     ${whereClause}
     GROUP BY ft.id, fc.name
     ORDER BY ft.is_pinned DESC, ft.last_activity DESC
     LIMIT $${paramCount++} OFFSET $${paramCount++}`,
    [...values, Number(limit), offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM forum_threads ft ${whereClause}`,
    values
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

// Create new forum thread
router.post('/threads', [
  body('title').isLength({ min: 1, max: 255 }),
  body('categoryId').isUUID(),
  body('isAnonymous').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const { title, categoryId, isAnonymous = true } = req.body;

  // Verify category exists
  const categoryResult = await query(
    'SELECT * FROM forum_categories WHERE id = $1 AND is_active = true',
    [categoryId]
  );

  if (categoryResult.rows.length === 0) {
    throw new CustomError('Category not found', 404);
  }

  // Create thread
  const threadResult = await query(
    `INSERT INTO forum_threads (title, category_id, is_anonymous)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [title, categoryId, isAnonymous]
  );

  const thread = threadResult.rows[0];

  res.status(201).json({
    success: true,
    thread
  });
}));

// Get thread posts
router.get('/threads/:threadId/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { threadId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  // Verify thread exists
  const threadResult = await query(
    'SELECT * FROM forum_threads WHERE id = $1',
    [threadId]
  );

  if (threadResult.rows.length === 0) {
    throw new CustomError('Thread not found', 404);
  }

  const postsResult = await query(
    `SELECT fp.*, u.first_name, u.last_name
     FROM forum_posts fp
     LEFT JOIN users u ON fp.author_id = u.id
     WHERE fp.thread_id = $1 AND fp.is_moderated = true
     ORDER BY fp.created_at ASC
     LIMIT $2 OFFSET $3`,
    [threadId, Number(limit), offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM forum_posts WHERE thread_id = $1 AND is_moderated = true',
    [threadId]
  );

  res.json({
    success: true,
    posts: postsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Create new post
router.post('/threads/:threadId/posts', [
  body('content').isLength({ min: 1, max: 5000 }),
  body('isAnonymous').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { threadId } = req.params;
  const userId = req.user!.id;
  const { content, isAnonymous = true } = req.body;

  // Verify thread exists and is not locked
  const threadResult = await query(
    'SELECT * FROM forum_threads WHERE id = $1',
    [threadId]
  );

  if (threadResult.rows.length === 0) {
    throw new CustomError('Thread not found', 404);
  }

  if (threadResult.rows[0].is_locked) {
    throw new CustomError('Thread is locked', 403);
  }

  // Create post
  const postResult = await query(
    `INSERT INTO forum_posts (thread_id, author_id, content, is_anonymous)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [threadId, isAnonymous ? null : userId, content, isAnonymous]
  );

  const post = postResult.rows[0];

  // Update thread reply count and last activity
  await query(
    'UPDATE forum_threads SET reply_count = reply_count + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1',
    [threadId]
  );

  res.status(201).json({
    success: true,
    post
  });
}));

// Vote on post
router.post('/posts/:postId/vote', [
  body('voteType').isIn(['upvote', 'downvote'])
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { postId } = req.params;
  const { voteType } = req.body;

  // Verify post exists
  const postResult = await query(
    'SELECT * FROM forum_posts WHERE id = $1',
    [postId]
  );

  if (postResult.rows.length === 0) {
    throw new CustomError('Post not found', 404);
  }

  // Update vote count
  const field = voteType === 'upvote' ? 'upvotes' : 'downvotes';
  await query(
    `UPDATE forum_posts SET ${field} = ${field} + 1 WHERE id = $1`,
    [postId]
  );

  res.json({
    success: true,
    message: 'Vote recorded successfully'
  });
}));

// Get posts for moderation (volunteer/admin only)
router.get('/moderation/posts', requireRole(['volunteer', 'college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const postsResult = await query(
    `SELECT fp.*, ft.title as thread_title, u.first_name, u.last_name
     FROM forum_posts fp
     JOIN forum_threads ft ON fp.thread_id = ft.id
     LEFT JOIN users u ON fp.author_id = u.id
     WHERE fp.is_moderated = false
     ORDER BY fp.created_at ASC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM forum_posts WHERE is_moderated = false'
  );

  res.json({
    success: true,
    posts: postsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Moderate post (volunteer/admin only)
router.patch('/posts/:postId/moderate', requireRole(['volunteer', 'college_admin', 'ngo_admin']), [
  body('action').isIn(['approve', 'reject']),
  body('moderationNotes').optional().isLength({ max: 500 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { postId } = req.params;
  const { action, moderationNotes } = req.body;
  const moderatorId = req.user!.id;

  // Verify post exists
  const postResult = await query(
    'SELECT * FROM forum_posts WHERE id = $1',
    [postId]
  );

  if (postResult.rows.length === 0) {
    throw new CustomError('Post not found', 404);
  }

  // Update post moderation status
  await query(
    `UPDATE forum_posts 
     SET is_moderated = $1, moderator_id = $2, moderation_notes = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [action === 'approve', moderatorId, moderationNotes, postId]
  );

  res.json({
    success: true,
    message: `Post ${action}d successfully`
  });
}));

// Report post
router.post('/posts/:postId/report', [
  body('reason').isLength({ min: 1, max: 500 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { postId } = req.params;
  const { reason } = req.body;
  const reporterId = req.user!.id;

  // Verify post exists
  const postResult = await query(
    'SELECT * FROM forum_posts WHERE id = $1',
    [postId]
  );

  if (postResult.rows.length === 0) {
    throw new CustomError('Post not found', 404);
  }

  // Create report (you might want to create a reports table)
  // For now, we'll just flag the post
  await query(
    'UPDATE forum_posts SET is_moderated = false, moderation_notes = $1 WHERE id = $2',
    [`Reported: ${reason}`, postId]
  );

  res.json({
    success: true,
    message: 'Post reported successfully'
  });
}));

export default router;
