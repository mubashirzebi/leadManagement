import { Response } from 'express';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import ActivityLog from '../models/ActivityLog';
import Organization from '../models/Organization';
import { AuthRequest } from '../middleware/auth';

export const createLead = async (req: AuthRequest, res: Response) => {
  try {
    const { name, mobile, source, project, budget, city, heat } = req.body;
    const organization_id = req.user?.organization_id;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    // Detect duplicate phone numbers within the organization
    const exists = await Lead.findOne({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      mobile
    });
    const isDuplicate = !!exists;

    const newLead = await Lead.create({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      assigned_to: null,
      name,
      mobile,
      source: source || 'Manual',
      project,
      budget,
      city,
      heat: heat || 'WARM',
      status: 'NEW',
      duplicateFlag: isDuplicate
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

    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only managers can assign leads' });
    }

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
        data: { total: 0, new: 0, callback: 0, interested: 0, visit_booked: 0, visited: 0, re_visit: 0, visits_today: 0, booked: 0, not_interested: 0, invalid_number: 0 }
      });
    }

    // Aggregate counts for different statuses
    const matchQuery: any = { organization_id: new mongoose.Types.ObjectId(organization_id as string) };
    
    // Staff can only see their own stats
    if (req.user?.role === 'staff') {
      matchQuery.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }

    // Exclude leads belonging to unlinked/inactive Facebook pages (soft delete/hide)
    const org = await Organization.findById(organization_id);
    if (org && org.meta_config?.pages) {
      const inactivePageNames = org.meta_config.pages
        .filter((p: any) => p.is_active === false)
        .map((p: any) => p.page_name);
      if (inactivePageNames.length > 0) {
        matchQuery.facebook_page_name = { $nin: inactivePageNames };
      }
    }

    const stats = await Lead.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Count visits scheduled for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const visitsTodayQuery = {
      ...matchQuery,
      status: { $in: ['VISIT_BOOKED', 'RE_VISIT'] },
      site_visit_at: { $gte: todayStart, $lte: todayEnd },
    };
    const visitsToday = await Lead.countDocuments(visitsTodayQuery);

    const formattedStats = {
      total: stats.reduce((acc, curr) => acc + curr.count, 0),
      new: stats.find(s => s._id === 'NEW')?.count || 0,
      callback: stats.find(s => s._id === 'CALLBACK')?.count || 0,
      interested: stats.find(s => s._id === 'INTERESTED')?.count || 0,
      visit_booked: stats.find(s => s._id === 'VISIT_BOOKED')?.count || 0,
      visited: stats.find(s => s._id === 'VISITED')?.count || 0,
      re_visit: stats.find(s => s._id === 'RE_VISIT')?.count || 0,
      visits_today: visitsToday,
      booked: stats.find(s => s._id === 'BOOKED')?.count || 0,
      not_interested: stats.find(s => s._id === 'NOT_INTERESTED')?.count || 0,
      invalid_number: stats.find(s => s._id === 'INVALID_NUMBER')?.count || 0,
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
    const { status, heat, assigned_to, search, page = 1, limit = 20 } = req.query;

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

    // Exclude leads belonging to unlinked/inactive Facebook pages (soft delete/hide)
    const org = await Organization.findById(organization_id);
    if (org && org.meta_config?.pages) {
      const inactivePageNames = org.meta_config.pages
        .filter((p: any) => p.is_active === false)
        .map((p: any) => p.page_name);
      if (inactivePageNames.length > 0) {
        query.facebook_page_name = { $nin: inactivePageNames };
      }
    }

    if (status) query.status = status;
    if (heat) query.heat = heat;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(query)
      .populate('assigned_to', '_id name mobile')
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

    const lead = await Lead.findOne(query).populate('assigned_to', '_id name mobile');

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
    const { status, heat, assigned_to, remark, duplicateFlag, site_visit_booked, site_visit_at, callback_reason, property_status, property_type, preferred_area, not_interested_reason, project, budget, activity_type, activity_content, visit_notes } = req.body;
    const organization_id = req.user?.organization_id;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      // Auto-cleanup sub-fields that don't belong to the new status
      // Clear CALLBACK-specific data when leaving CALLBACK status
      if (status !== 'CALLBACK') updateData.callback_reason = null;
      // Clear NOT_INTERESTED-specific data when leaving NOT_INTERESTED status
      if (status !== 'NOT_INTERESTED') updateData.not_interested_reason = null;
      // INTERESTED data (property_status, property_type, preferred_area, budget)
      // is NEVER auto-cleared — it persists downstream for insights
    }
    if (heat) updateData.heat = heat;
    if (site_visit_booked !== undefined) updateData.site_visit_booked = site_visit_booked;
    if (site_visit_at !== undefined) updateData.site_visit_at = site_visit_at;
    if (assigned_to !== undefined) {
      if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only managers can assign leads' });
      }
      updateData.assigned_to = assigned_to;
    }
    if (duplicateFlag !== undefined) updateData.duplicateFlag = duplicateFlag;
    if (remark !== undefined) updateData.remark = remark;
    if (callback_reason !== undefined) updateData.callback_reason = callback_reason;
    if (property_status !== undefined) updateData.property_status = property_status;
    if (property_type !== undefined) updateData.property_type = property_type;
    if (preferred_area !== undefined) updateData.preferred_area = preferred_area;
    if (not_interested_reason !== undefined) updateData.not_interested_reason = not_interested_reason;
    if (project !== undefined) updateData.project = project;
    if (budget !== undefined) updateData.budget = budget;

    const query: any = { _id: id, organization_id };
    if (req.user?.role === 'staff') {
      query.assigned_to = req.user.id;
    }

    // Fetch existing lead for visit_history context
    const existingLead = await Lead.findOne(query);
    if (!existingLead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Push visit_history entry when status changes to VISITED
    if (status === 'VISITED') {
      const visitEntry: any = {
        scheduled_at: existingLead.site_visit_at || new Date(),
        completed_at: new Date(),
        outcome: 'completed',
        notes: visit_notes || null,
        created_at: new Date(),
      };
      updateData.$push = { visit_history: visitEntry };
      updateData.$inc = { visit_count: 1 };
    }
    // Push visit_history entry when visit is cancelled
    if (activity_type === 'visit_cancelled') {
      const cancelEntry: any = {
        scheduled_at: existingLead.site_visit_at || new Date(),
        outcome: 'cancelled',
        cancellation_reason: activity_content?.replace('Site visit cancelled — ', ''),
        created_at: new Date(),
      };
      if (!updateData.$push) updateData.$push = {};
      updateData.$push.visit_history = cancelEntry;
      // Don't increment visit_count for cancellations
    }

    const lead = await Lead.findOneAndUpdate(
      query,
      updateData.$push || updateData.$inc ? updateData : { $set: updateData },
      { new: true }
    );

    // Log the update
    const changes: string[] = [];
    if (status) changes.push(`status to ${status}`);
    if (heat) changes.push(`heat to ${heat}`);
    if (assigned_to !== undefined) changes.push(`assignment`);
    if (duplicateFlag !== undefined) changes.push(`duplicate status to ${duplicateFlag ? 'Duplicate' : 'Not Duplicate'}`);
    if (site_visit_booked !== undefined || site_visit_at !== undefined) changes.push(`site visit`);
    if (remark !== undefined) changes.push(`remark`);

    await ActivityLog.create({
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      lead_id: new mongoose.Types.ObjectId(id as string),
      user_id: new mongoose.Types.ObjectId(req.user?.id),
      type: activity_type || (remark !== undefined ? 'remark' : 'update'),
      content: activity_content || (remark !== undefined ? `Remark: ${String(remark)}` : `Updated ${changes.join(', ')}`)
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

    const logQuery: any = { 
      lead_id: new mongoose.Types.ObjectId(id as string), 
      organization_id 
    };

    if (req.user?.role === 'staff') {
      const lead = await Lead.findOne({ _id: id, organization_id, assigned_to: req.user.id }).select('_id');
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found or access denied' });
      }
    }

    const logs = await ActivityLog.find(logQuery)
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
