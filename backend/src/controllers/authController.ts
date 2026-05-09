import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { sendSuperAdminPasswordResetEmail } from '../services/emailService';

const RESET_TOKEN_TTL_MINUTES = 15;

const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const login = async (req: Request, res: Response) => {
  try {
    const { mobile, password } = req.body;
    
    if (!mobile || !password) {
      return res.status(400).json({ success: false, message: 'Mobile and password required' });
    }

    const user = await User.findOne({ mobile }).populate('organization_id');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password as string);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check organization status (Kill Switch) if it's not a superadmin
    if (user.role !== 'superadmin' && user.organization_id) {
      const org = user.organization_id as any;
      if (org.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Your agency account has been suspended. Please contact support.' });
      }
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        organization_id: user.organization_id?._id || null,
        must_change_password: user.must_change_password
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          must_change_password: user.must_change_password
        }
      }
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updatePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user?.id;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      must_change_password: false
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('[Update Password Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const forgotSuperAdminPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const genericResponse: any = {
      success: true,
      message: 'If a SuperAdmin exists with this email, reset instructions have been sent.'
    };

    const user = await User.findOne({ email: normalizedEmail, role: 'superadmin' });
    if (!user) {
      return res.json(genericResponse);
    }

    const token = crypto.randomInt(100000, 1000000).toString();
    user.reset_password_token_hash = hashResetToken(token);
    user.reset_password_expires_at = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await user.save();

    await sendSuperAdminPasswordResetEmail({
      to: normalizedEmail,
      token,
      name: user.name
    });

    if (process.env.NODE_ENV !== 'production') {
      genericResponse.data = { resetToken: token };
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('[Forgot SuperAdmin Password Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const resetSuperAdminPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, token, and newPassword are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const tokenHash = hashResetToken(String(token));

    const user = await User.findOne({
      email: normalizedEmail,
      role: 'superadmin',
      reset_password_token_hash: tokenHash,
      reset_password_expires_at: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.must_change_password = false;
    user.reset_password_token_hash = null;
    user.reset_password_expires_at = null;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('[Reset SuperAdmin Password Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
