import { Response } from 'express';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';

export const createLead = async (req: AuthRequest, res: Response) => {
  try {
    const { name, mobile, source, project, budget, city, temperature } = req.body;
    const organization_id = req.user?.organization_id;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    const newLead = await Lead.create({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      assigned_to: null,
      name,
      mobile,
      source: source || 'Manual',
      project,
      budget,
      city,
      temperature: temperature || 'Warm',
      status: 'New'
    });

    res.status(201).json({ success: true, data: newLead, message: 'Lead created manually' });
  } catch (error) {
    console.error('[Create Lead Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const bulkAssignLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds, staffId } = req.body;
    const organization_id = req.user?.organization_id;

    if (!organization_id || !Array.isArray(leadIds) || !staffId) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    await Lead.updateMany(
      { _id: { $in: leadIds }, organization_id },
      { $set: { assigned_to: staffId } }
    );

    // Create Activity Logs for each assigned lead
    const logs = leadIds.map(id => ({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      lead_id: new mongoose.Types.ObjectId(id as string),
      user_id: new mongoose.Types.ObjectId(req.user?.id),
      type: 'assignment',
      content: 'Assigned to Staff'
    }));
    await ActivityLog.insertMany(logs);

    res.json({ success: true, message: 'Leads assigned successfully' });
  } catch (error) {
    console.error('[Bulk Assign Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;

    if (!organization_id || !mongoose.Types.ObjectId.isValid(organization_id as string)) {
      return res.json({ 
        success: true, 
        data: { total: 0, new: 0, contacted: 0, qualified: 0, closed: 0 } 
      });
    }

    // Aggregate counts for different statuses
    const matchQuery: any = { organization_id: new mongoose.Types.ObjectId(organization_id as string) };
    
    // Staff can only see their own stats
    if (req.user?.role === 'staff') {
      matchQuery.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }

    const stats = await Lead.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const formattedStats = {
      total: stats.reduce((acc, curr) => acc + curr.count, 0),
      new: stats.find(s => s._id === 'New')?.count || 0,
      contacted: stats.find(s => s._id === 'Contacted')?.count || 0,
      qualified: stats.find(s => s._id === 'Qualified')?.count || 0,
      closed: stats.find(s => s._id === 'Closed')?.count || 0,
    };

    res.json({ success: true, data: formattedStats });
  } catch (error) {
    console.error('[Get Dashboard Stats Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getLeads = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    const { status, temperature, assigned_to, search, page = 1, limit = 20 } = req.query;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    const query: any = { organization_id };

    // Staff can ONLY see leads assigned to them
    if (req.user?.role === 'staff') {
      query.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    } else if (assigned_to) {
      query.assigned_to = assigned_to === 'null' ? null : assigned_to;
    }

    if (status) query.status = status;
    if (temperature) query.temperature = temperature;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(query)
      .sort({ created_at: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, data: leads });
  } catch (error) {
    console.error('[Get Leads Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getLeadDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = req.user?.organization_id;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    const query: any = { _id: id, organization_id };
    if (req.user?.role === 'staff') {
      query.assigned_to = req.user.id;
    }

    const lead = await Lead.findOne(query);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found or access denied' });
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    console.error('[Get Lead Details Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, temperature, assigned_to, remark } = req.body;
    const organization_id = req.user?.organization_id;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (temperature) updateData.temperature = temperature;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;

    const query: any = { _id: id, organization_id };
    if (req.user?.role === 'staff') {
      query.assigned_to = req.user.id;
    }

    const lead = await Lead.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Log the update
    await ActivityLog.create({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      lead_id: new mongoose.Types.ObjectId(id as string),
      user_id: new mongoose.Types.ObjectId(req.user?.id),
      type: 'update',
      content: `Updated lead status to ${status}`
    });

    res.json({ success: true, data: lead, message: 'Lead updated successfully' });
  } catch (error) {
    console.error('[Update Lead Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getLeadLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = req.user?.organization_id;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID' });
    }

    const logs = await ActivityLog.find({ 
      lead_id: new mongoose.Types.ObjectId(id as string), 
      organization_id 
    })
      .sort({ created_at: -1 })
      .populate('user_id', 'name');

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('[Get Lead Logs Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOrgLogs = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    if (!mongoose.Types.ObjectId.isValid(organization_id as string)) {
      return res.status(400).json({ success: false, message: 'Invalid organization ID' });
    }

    const logQuery: any = { 
      organization_id: new mongoose.Types.ObjectId(organization_id as string) 
    };

    // Staff can only see logs of leads assigned to them
    if (req.user?.role === 'staff') {
      const myLeads = await Lead.find({ assigned_to: req.user.id }, '_id');
      const leadIds = myLeads.map(l => l._id);
      logQuery.lead_id = { $in: leadIds };
    }

    const logs = await ActivityLog.find(logQuery)
      .sort({ created_at: -1 })
      .limit(10)
      .populate('user_id', 'name')
      .populate('lead_id', 'name');

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('[Get Org Logs Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
