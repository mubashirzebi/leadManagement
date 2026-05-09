import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Organization from '../models/Organization';
import Lead from '../models/Lead';

export const handleIncomingWebhook = async (req: Request, res: Response) => {
  try {
    const orgId = req.query.key as string;

    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing organization key' });
    }

    const org = await Organization.findById(orgId);
    if (!org || org.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Organization is invalid or suspended' });
    }

    const { name, mobile, source, project, budget, city } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'Name and mobile are required' });
    }

    const newLead = await Lead.create({
      organization_id: org._id,
      assigned_to: null, // Always goes to unassigned queue
      name,
      mobile,
      source: source || 'Webhook',
      project,
      budget,
      city,
      status: 'New',
      temperature: 'Warm'
    });

    res.status(201).json({ success: true, message: 'Lead captured', data: newLead });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
