import { Response } from 'express';
import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';

export const createReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, remind_at, remark } = req.body;
    const organization_id = req.user?.organization_id;
    const user_id = req.user?.id;

    const reminder = await Reminder.create({
      organization_id: new mongoose.Types.ObjectId(organization_id),
      lead_id: new mongoose.Types.ObjectId(lead_id),
      user_id: new mongoose.Types.ObjectId(user_id),
      remind_at,
      remark,
      is_sent: false
    });

    // Log the reminder creation
    await ActivityLog.create({
      organization_id: new mongoose.Types.ObjectId(organization_id),
      lead_id: new mongoose.Types.ObjectId(lead_id),
      user_id: new mongoose.Types.ObjectId(user_id),
      type: 'reminder',
      content: `Scheduled a reminder for ${new Date(remind_at).toLocaleString()}: ${remark}`
    });

    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    console.error('[Create Reminder Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
