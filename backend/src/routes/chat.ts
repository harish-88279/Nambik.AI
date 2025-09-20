import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { analyzeSentiment, generateAIResponse } from '../services/aiService';
import { getIO } from '../services/socketService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Start a new chat session
router.post('/sessions', [
  body('sessionType').optional().isIn(['ai_chat', 'crisis_support']),
  body('isAnonymous').optional().isBoolean(),
  body('language').optional().isLength({ min: 2, max: 10 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const { sessionType = 'ai_chat', isAnonymous = true, language = 'en' } = req.body;

  const sessionResult = await query(
    `INSERT INTO chat_sessions (user_id, session_type, is_anonymous, language)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, sessionType, isAnonymous, language]
  );

  res.status(201).json({
    success: true,
    session: sessionResult.rows[0]
  });
}));

// List available peers (volunteers) for chat
router.get('/peers/available', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Return active volunteers in same institution (if any)
  const userInstitution = req.user!.institution_id || null;
  const params: any[] = [];
  let where = `u.role = 'volunteer' AND u.is_active = true`;
  if (userInstitution) {
    where += ` AND (u.institution_id = $1 OR u.institution_id IS NULL)`;
    params.push(userInstitution);
  }

  const peersResult = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM users u
     WHERE ${where}
     ORDER BY u.first_name, u.last_name`,
    params
  );

  res.json({ success: true, peers: peersResult.rows });
}));

// Start a new peer chat session (student chooses a peer/volunteer)
router.post('/sessions/peer', [
  body('peerId').isUUID(),
  body('language').optional().isLength({ min: 2, max: 10 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const userId = req.user!.id;
  const { peerId, language = 'en' } = req.body;

  // Verify selected peer is an active volunteer
  const peerResult = await query(
    `SELECT id, role, is_active FROM users WHERE id = $1 AND role = 'volunteer' AND is_active = true`,
    [peerId]
  );
  if (peerResult.rows.length === 0) {
    throw new CustomError('Selected peer not available', 404);
  }

  // Create session assigned to that peer (keep user anonymous)
  const sessionResult = await query(
    `INSERT INTO chat_sessions (user_id, session_type, is_anonymous, language, counselor_id)
     VALUES ($1, 'peer_chat', true, $2, $3)
     RETURNING *`,
    [userId, language, peerId]
  );

  const session = sessionResult.rows[0];

  // Notify the peer in real-time
  try {
    const io = getIO();
    io.to(`user:${peerId}`).emit('peerChat:assigned', {
      sessionId: session.id,
      studentId: userId,
      language: session.language,
      createdAt: session.created_at
    });
  } catch (err) {
    logger.warn('Socket notification failed (peerChat:assigned):', err);
  }

  res.status(201).json({
    success: true,
    session
  });
}));

// For peers to fetch sessions assigned to them
router.get('/sessions/assigned', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const peerId = req.user!.id;
  // Only volunteers can use this effectively, but we allow others to see if assigned
  const result = await query(
    `SELECT cs.*,
            u.first_name as user_first_name, u.last_name as user_last_name
     FROM chat_sessions cs
     JOIN users u ON cs.user_id = u.id
     WHERE cs.session_type = 'peer_chat' AND cs.counselor_id = $1 AND cs.ended_at IS NULL
     ORDER BY cs.created_at DESC`,
    [peerId]
  );
  res.json({ success: true, sessions: result.rows });
}));

// Send a message in a chat session
router.post('/sessions/:sessionId/messages', [
  body('messageText').isLength({ min: 1, max: 2000 }),
  body('senderType').isIn(['user', 'ai', 'counselor'])
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { sessionId } = req.params;
  const { messageText, senderType } = req.body;
  const userId = req.user!.id;

  // Verify session belongs to user
  const sessionResult = await query(
    'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );

  if (sessionResult.rows.length === 0) {
    throw new CustomError('Session not found', 404);
  }

  const session = sessionResult.rows[0];

  // Check permissions for counselor_chat
  if (session.session_type === 'counselor_chat') {
    if (session.user_id !== userId && session.counselor_id !== userId) {
      throw new CustomError('Access denied to this chat session', 403);
    }
    // Ensure senderType is 'user' or 'counselor' for counselor_chat
    if (!['user', 'counselor'].includes(senderType)) {
      throw new CustomError('Invalid sender type for counselor chat', 400);
    }
  }

  // Check permissions for peer_chat
  if (session.session_type === 'peer_chat') {
    // For peer chat, ensure anonymity if isAnonymous is true
    if (session.is_anonymous && senderType !== 'user') {
      throw new CustomError('Invalid sender type for anonymous peer chat', 400);
    }
  }

  // Analyze sentiment for user messages
  let sentimentScore = null;
  let isFlagged = false;
  let flagReason = null;

  if (senderType === 'user') {
    try {
      sentimentScore = await analyzeSentiment(messageText);
      
      // Flag high-risk messages
      if (sentimentScore < -0.7) {
        isFlagged = true;
        flagReason = 'High negative sentiment detected';
        
        // Create crisis alert if sentiment is extremely negative
        if (sentimentScore < -0.9) {
          const alertResult = await query(
            `INSERT INTO crisis_alerts (user_id, alert_type, severity_level, description, source_session_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, 'ai_detected', 8, 'Extreme negative sentiment in chat', sessionId]
          );

          const newAlert = alertResult.rows[0];

          // Emit a real-time notification to admins
          try {
            const io = getIO();
            io.emit('newCrisisAlert', {
              id: newAlert.id,
              userId: newAlert.user_id,
              description: newAlert.description,
              severity: newAlert.severity_level,
              timestamp: newAlert.created_at,
            });
          } catch (err) {
            logger.warn('Socket notification failed (newCrisisAlert):', err);
          }
        }
      }
    } catch (error) {
      logger.error('Sentiment analysis error:', error);
    }
  }

  // Store the message
  const messageResult = await query(
    `INSERT INTO chat_messages (session_id, sender_type, message_text, sentiment_score, is_flagged, flag_reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [sessionId, senderType, messageText, sentimentScore, isFlagged, flagReason]
  );

  const message = messageResult.rows[0];

  // Generate AI response if it's a user message and session is AI chat
  let aiResponse = null;
  if (senderType === 'user' && session.session_type === 'ai_chat') {
    try {
      aiResponse = await generateAIResponse(messageText, session.language);
      
      // Store AI response
      const aiMessageResult = await query(
        `INSERT INTO chat_messages (session_id, sender_type, message_text)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [sessionId, 'ai', aiResponse]
      );
      
      aiResponse = aiMessageResult.rows[0];
    } catch (error) {
      logger.error('AI response generation error:', error);
    }
  }

  res.status(201).json({
    success: true,
    message,
    aiResponse
  });
}));

// Get chat session messages
router.get('/sessions/:sessionId/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;
  const { page = 1, limit = 50 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const requesterId = req.user!.id;

  // Verify session belongs to requester (as student or assigned peer/counselor)
  const sessionResult = await query(
    'SELECT * FROM chat_sessions WHERE id = $1 AND (user_id = $2 OR counselor_id = $2)',
    [sessionId, requesterId]
  );

  if (sessionResult.rows.length === 0) {
    throw new CustomError('Session not found or access denied', 404);
  }

  const messagesResult = await query(
    `SELECT * FROM chat_messages 
     WHERE session_id = $1 
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [sessionId, Number(limit), offset]
  );

  res.json({
    success: true,
    messages: messagesResult.rows
  });
}));

// Get user's chat sessions
router.get('/sessions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const userId = req.user!.id;

  const sessionsResult = await query(
    `SELECT cs.*, 
            COUNT(cm.id) as message_count,
            MAX(cm.created_at) as last_message_at
     FROM chat_sessions cs
     LEFT JOIN chat_messages cm ON cs.id = cm.session_id
     WHERE cs.user_id = $1
     GROUP BY cs.id
     ORDER BY cs.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, Number(limit), offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM chat_sessions WHERE user_id = $1',
    [userId]
  );

  res.json({
    success: true,
    sessions: sessionsResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// End a chat session
router.patch('/sessions/:sessionId/end', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;
  const userId = req.user!.id;

  // Verify session belongs to user
  const sessionResult = await query(
    'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );

  if (sessionResult.rows.length === 0) {
    throw new CustomError('Session not found', 404);
  }

  await query(
    'UPDATE chat_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = $1',
    [sessionId]
  );

  res.json({
    success: true,
    message: 'Session ended successfully'
  });
}));

// Get flagged messages (admin/counselor only)
router.get('/flagged', requireRole(['counselor', 'college_admin', 'ngo_admin']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const messagesResult = await query(
    `SELECT cm.*, cs.session_type, cs.language, u.email, u.role
     FROM chat_messages cm
     JOIN chat_sessions cs ON cm.session_id = cs.id
     JOIN users u ON cs.user_id = u.id
     WHERE cm.is_flagged = true
     ORDER BY cm.created_at DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM chat_messages WHERE is_flagged = true'
  );

  res.json({
    success: true,
    messages: messagesResult.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
    }
  });
}));

// Update message flag status (admin/counselor only)
router.patch('/messages/:messageId/flag', requireRole(['counselor', 'college_admin', 'ngo_admin']), [
  body('isFlagged').isBoolean(),
  body('flagReason').optional().isLength({ min: 1, max: 500 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new CustomError('Invalid input data', 400);
  }

  const { messageId } = req.params;
  const { isFlagged, flagReason } = req.body;

  await query(
    'UPDATE chat_messages SET is_flagged = $1, flag_reason = $2 WHERE id = $3',
    [isFlagged, flagReason, messageId]
  );

  res.json({
    success: true,
    message: 'Message flag status updated successfully'
  });
}));

export default router;
