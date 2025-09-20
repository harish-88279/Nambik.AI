import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

let ioInstance: SocketIOServer; // Declare ioInstance here

// Expose a safe getter for the IO instance
export const getIO = (): SocketIOServer => {
  if (!ioInstance) {
    throw new Error('Socket.io is not initialized yet');
  }
  return ioInstance;
};

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export const setupSocketHandlers = (io: SocketIOServer): void => {
  ioInstance = io; // Assign the passed io to ioInstance

  // Authentication middleware for socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Verify user exists and is active
      const userResult = await query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
        return next(new Error('Authentication error: User not found or inactive'));
      }

      const user = userResult.rows[0];
      socket.userId = user.id;
      socket.userRole = user.role;
      
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    logger.info(`User ${socket.userId} connected via socket`);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Join role-based rooms
    if (socket.userRole) {
      socket.join(`role:${socket.userRole}`);
    }

    // Join active chat sessions
    try {
      interface ChatSessionRow {
        id: string;
      }
      const activeSessions = await query(
        'SELECT id FROM chat_sessions WHERE user_id = $1 OR counselor_id = $1',
        [socket.userId]
      );
      activeSessions.rows.forEach((session: ChatSessionRow) => {
        socket.join(`session:${session.id}`);
      });
    } catch (error) {
      logger.error('Failed to join active chat sessions:', error);
    }

    // Join a chat session room
    socket.on('chat:join', async (data) => {
      try {
        const { sessionId } = data;
        const sessionResult = await query(
          'SELECT id, user_id, counselor_id FROM chat_sessions WHERE id = $1',
          [sessionId]
        );
        if (sessionResult.rows.length === 0) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }
        const session = sessionResult.rows[0];
        if (session.user_id !== socket.userId && session.counselor_id !== socket.userId) {
          socket.emit('error', { message: 'Access denied to this chat session' });
          return;
        }
        socket.join(`session:${sessionId}`);
      } catch (error) {
        logger.error('Failed to join chat session:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Handle chat messages
    socket.on('chat:message', async (data) => {
      try {
        const { sessionId, message, senderType } = data;
        
        // Verify session belongs to user or counselor
        const sessionResult = await query(
          'SELECT * FROM chat_sessions WHERE id = $1',
          [sessionId]
        );

        if (sessionResult.rows.length === 0) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        const session = sessionResult.rows[0];

        // Permission check for counselor_chat
        if (session.session_type === 'counselor_chat') {
          if (session.user_id !== socket.userId && session.counselor_id !== socket.userId) {
            socket.emit('error', { message: 'Access denied to this chat session' });
            return;
          }
          // Ensure senderType is 'user' or 'counselor' for counselor_chat
          if (!['user', 'counselor'].includes(senderType)) {
            socket.emit('error', { message: 'Invalid sender type for counselor chat' });
            return;
          }
        }

        // Permission check for peer_chat
        if (session.session_type === 'peer_chat') {
          // Allow both student and peer to send messages
          const isStudent = session.user_id === socket.userId;
          const isPeer = session.counselor_id === socket.userId;
          if (!isStudent && !isPeer) {
            socket.emit('error', { message: 'Access denied to this peer chat' });
            return;
          }
          // Only allow valid sender types
          if (!['user', 'counselor'].includes(senderType)) {
            socket.emit('error', { message: 'Invalid sender type for peer chat' });
            return;
          }
        }

        // Store message in database
        const messageResult = await query(
          `INSERT INTO chat_messages (session_id, sender_type, message_text)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [sessionId, senderType, message]
        );

        const savedMessage = messageResult.rows[0];

        // Prepare message for broadcast (anonymize student if peer chat)
        let broadcastMessage = { ...savedMessage } as any;
        if (session.session_type === 'peer_chat' && session.is_anonymous && savedMessage.sender_type === 'user') {
          broadcastMessage.sender_type = 'anonymous';
        }

        // Broadcast to session participants (room) and personal rooms as fallback
        io.to(`session:${sessionId}`).emit('chat:message', broadcastMessage);
        io.to(`user:${session.user_id}`).emit('chat:message', broadcastMessage);
        if (session.counselor_id) {
          io.to(`user:${session.counselor_id}`).emit('chat:message', broadcastMessage);
        }

        // Notify counselors if it's a crisis message (already handled in chat.ts and surveys.ts)

      } catch (error) {
        logger.error('Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle appointment notifications
    socket.on('appointment:join', (appointmentId) => {
      socket.join(`appointment:${appointmentId}`);
    });

    // Handle forum notifications
    socket.on('forum:join', (threadId) => {
      socket.join(`forum:${threadId}`);
    });

    // Handle typing indicators
    socket.on('chat:typing', (data) => {
      const { sessionId, isTyping } = data;
      socket.to(`session:${sessionId}`).emit('chat:typing', {
        userId: socket.userId,
        isTyping
      });
    });

    // Handle online status
    socket.on('user:online', () => {
      socket.broadcast.emit('user:status', {
        userId: socket.userId,
        status: 'online'
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User ${socket.userId} disconnected`);
      
      // Notify others that user went offline
      socket.broadcast.emit('user:status', {
        userId: socket.userId,
        status: 'offline'
      });
    });

    // Handle error
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  // Broadcast crisis alerts to counselors
  const broadcastCrisisAlert = async (alertData: any) => {
    io.to('role:counselor').emit('crisis:alert', alertData);
  };

  // Broadcast appointment reminders
  const broadcastAppointmentReminder = async (appointmentData: any) => {
    io.to(`user:${appointmentData.studentId}`).emit('appointment:reminder', appointmentData);
    io.to(`user:${appointmentData.counselorId}`).emit('appointment:reminder', appointmentData);
  };

  // Broadcast forum notifications
  const broadcastForumNotification = async (notificationData: any) => {
    io.to(`forum:${notificationData.threadId}`).emit('forum:notification', notificationData);
  };

  // Export functions for use in other parts of the application
  (io as any).broadcastCrisisAlert = broadcastCrisisAlert;
  (io as any).broadcastAppointmentReminder = broadcastAppointmentReminder;
  (io as any).broadcastForumNotification = broadcastForumNotification;
};

export { ioInstance as io };
