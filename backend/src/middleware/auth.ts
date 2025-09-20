import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    institution_id?: string;
    firstName?: string;
    lastName?: string;
    profilePictureUrl?: string;
    createdAt?: string;
    lastLogin?: string;
    phone?: string;
  };
}

export const authenticateToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Verify user still exists and is active
    const userResult = await query(
      'SELECT id, email, role, institution_id, is_active, first_name, last_name, created_at, last_login, phone FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const user = userResult.rows[0];
    
    if (!user.is_active) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
      return;
    }

    (req as any).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      institution_id: user.institution_id,
      firstName: user.first_name,
      lastName: user.last_name,
      profilePictureUrl: user.profile_picture_url,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      phone: user.phone,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    } else {
      logger.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthenticatedRequest['user'];
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['college_admin', 'ngo_admin']);
export const requireCounselor = requireRole(['counselor', 'college_admin', 'ngo_admin']);
export const requireVolunteer = requireRole(['volunteer', 'college_admin', 'ngo_admin']);

export const requireSameInstitution = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user as AuthenticatedRequest['user'];
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Admins can access any institution
    if (['college_admin', 'ngo_admin'].includes(user.role)) {
      next();
      return;
    }

    const targetUserId = (req as any).params?.userId || (req as any).body?.userId;
    if (!targetUserId) {
      next();
      return;
    }

    const targetUserResult = await query(
      'SELECT institution_id FROM users WHERE id = $1',
      [targetUserId]
    );

    if (targetUserResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const targetUser = targetUserResult.rows[0];
    
    if (user.institution_id !== targetUser.institution_id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: Different institution'
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Institution check error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};
