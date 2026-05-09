import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

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
