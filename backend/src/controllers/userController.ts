import { Request, Response } from 'express';
import User from '../models/User';

export const getStaff = async (req: Request, res: Response) => {
  try {
    const organization_id = (req as any).user.organization_id;
    
    const staff = await User.find({ 
      organization_id, 
      role: { $in: ['staff', 'admin'] } 
    }).select('name _id');

    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
