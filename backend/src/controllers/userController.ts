import { Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

export const getTeamList = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    if (!organization_id) return res.status(403).json({ success: false, message: 'No org' });
    
    const team = await User.find({ 
      organization_id, 
      role: { $in: ['staff', 'admin'] } 
    }).select('-password').sort({ created_at: -1 });

    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { name, mobile, password, role } = req.body;
    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Admins can create team members' });
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Check if mobile already exists
    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Mobile number already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      mobile,
      password: hashedPassword,
      role,
      organization_id,
      must_change_password: true // Force them to change on first login
    });

    res.status(201).json({ success: true, message: 'Team member created', data: newUser });
  } catch (error) {
    console.error('[Create Team Member Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
