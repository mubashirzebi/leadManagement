import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface JwtPayload {
  id: string;
  role: string;
  organization_id: string | null;
  must_change_password: boolean;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    
    // Kill Switch validation on every request
    if (decoded.role !== 'platform_owner' && decoded.organization_id) {
      const user = await User.findById(decoded.id).populate('organization_id');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      
      const org = user.organization_id as any;
      if (org && org.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Your agency account has been suspended.' });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const requirePlatformOwner = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'platform_owner') {
    return res.status(403).json({ success: false, message: 'Platform Owner access required' });
  }
  next();
};
