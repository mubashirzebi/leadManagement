import { Response } from 'express';
import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import ActivityLog from '../models/ActivityLog';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth';

export const deleteRemindersByLead = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id } = req.query;
    const organization_id = req.user?.organization_id;

    if (!organization_id || !lead_id) {
      return res.status(400).json({ success: false, message: 'lead_id query param required' });
    }

    await Reminder.deleteMany({
      lead_id: new mongoose.Types.ObjectId(lead_id as string),
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
    });

    // Clear next_reminder fields on the Lead so the frontend reflects the change
    await Lead.findByIdAndUpdate(lead_id, {
      $set: { next_reminder_at: null, next_reminder_remark: null },
    });

    res.json({ success: true, message: 'Reminders cleared' });
  } catch (error) {
    console.error('[Delete Reminders Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, remind_at, remark } = req.body;
    const organization_id = req.user?.organization_id;
    const user_id = req.user?.id;

    const reminder = await Reminder.create({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      lead_id: new mongoose.Types.ObjectId(lead_id as string),
      user_id: new mongoose.Types.ObjectId(user_id as string),
      remind_at,
      remark,
      is_sent: false
    });

    // Sync next_reminder fields on the Lead so the frontend can display it
    await Lead.findByIdAndUpdate(lead_id, {
      $set: { next_reminder_at: remind_at, next_reminder_remark: remark },
    });

    // Log the reminder creation
    await ActivityLog.create({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      lead_id: new mongoose.Types.ObjectId(lead_id as string),
      user_id: new mongoose.Types.ObjectId(user_id as string),
      type: 'reminder',
      content: `Scheduled a reminder for ${new Date(remind_at).toLocaleString()}: ${remark}`
    });

    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    console.error('[Create Reminder Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
