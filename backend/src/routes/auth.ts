import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Route to start Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback route
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err: any, user: any, info: any) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }

    const payload = {
      id: user.id,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: '1d', // Token expires in one day
    });

    // Redirect to the frontend callback page with the token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  })(req, res, next);
});

// Route for email and password login
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  try {
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const user = userResult.rows[0];

    // The user might not have a password if they registered with Google
    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'Please log in with Google',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const payload = {
      id: user.id,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: '1d',
    });

    return res.json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// Route for your frontend to check if a user is authenticated
router.get('/me', authenticateToken, (req: any, res) => {
  // The user object is attached to the request by the authenticateToken middleware
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

// Route for logging out
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect(`${process.env.FRONTEND_URL}`); // Redirect to frontend home page
  });
});

export default router;