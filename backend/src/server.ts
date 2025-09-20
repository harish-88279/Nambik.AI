// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import appointmentRoutes from './routes/appointments';
import chatRoutes from './routes/chat';
import forumRoutes from './routes/forum';
import resourceRoutes from './routes/resources';
import surveyRoutes from './routes/surveys';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import crisisAlertsRoutes from './routes/crisisAlerts';
import feedbackRoutes from './routes/feedback';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';
import { setupSocketHandlers } from './services/socketService';

// Import services
import './services/passportService';

// Import database
import { initializeDatabase } from './database/connection';



const app = express();
app.set('trust proxy', 1);
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/appointments', authenticateToken, appointmentRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/forum', authenticateToken, forumRoutes);
app.use('/api/resources', authenticateToken, resourceRoutes);
app.use('/api/surveys', authenticateToken, surveyRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/crisis-alerts', authenticateToken, crisisAlertsRoutes);
app.use('/api/feedback', authenticateToken, feedbackRoutes);

// Socket.IO setup
setupSocketHandlers(io);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('✅ Database connected successfully');
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

startServer();
