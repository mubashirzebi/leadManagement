import { Response } from 'express';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import ActivityLog from '../models/ActivityLog';
import Organization from '../models/Organization';
import User from '../models/User';
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
    const { from, to } = req.query;

    if (!organization_id || !mongoose.Types.ObjectId.isValid(organization_id as string)) {
      return res.json({
        success: true,
        data: { total: 0, new: 0, callback: 0, interested: 0, visit_booked: 0, visited: 0, re_visit_booked: 0, revisited: 0, visits_today: 0, total_visited: 0, booked: 0, not_interested: 0, invalid_number: 0, unassigned_leads: 0 }
      });
    }

    // Aggregate counts for different statuses
    const matchQuery: any = { organization_id: new mongoose.Types.ObjectId(organization_id as string) };
    
    // Staff can only see their own stats
    if (req.user?.role === 'staff') {
      matchQuery.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }

    // Time filter — applies to all aggregations below
    if (from && to) {
      matchQuery.created_at = { $gte: new Date(from as string), $lte: new Date(to as string) };
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
    const visitsTodayQuery: any = {
      organization_id: new mongoose.Types.ObjectId(organization_id as string),
      status: { $in: ['VISIT_BOOKED', 'RE_VISIT'] },
      site_visit_at: { $gte: todayStart, $lte: todayEnd },
    };
    if (req.user?.role === 'staff') {
      visitsTodayQuery.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }
    const visitsToday = await Lead.countDocuments(visitsTodayQuery);

    // Sum all visit_count values for total visited metric (multi-project visits count per project)
    const totalVisitsAgg = await Lead.aggregate([
      { $match: { ...matchQuery, visit_count: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$visit_count' } } }
    ]);
    const totalVisits = totalVisitsAgg.length > 0 ? totalVisitsAgg[0].total : 0;

    // Sum all revisit_count values for revisited metric
    const totalRevisitedAgg = await Lead.aggregate([
      { $match: { ...matchQuery, revisit_count: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$revisit_count' } } }
    ]);
    const totalRevisited = totalRevisitedAgg.length > 0 ? totalRevisitedAgg[0].total : 0;

    // Count unassigned leads (exclude dead leads that don't need assignment)
    const unassignedMatch: any = { ...matchQuery, assigned_to: null };
    unassignedMatch.status = { $nin: ['NOT_INTERESTED', 'INVALID_NUMBER'] };
    const unassignedCount = await Lead.countDocuments(unassignedMatch);

    const formattedStats = {
      total: stats.reduce((acc, curr) => acc + curr.count, 0),
      new: stats.find(s => s._id === 'NEW')?.count || 0,
      callback: stats.find(s => s._id === 'CALLBACK')?.count || 0,
      interested: stats.find(s => s._id === 'INTERESTED')?.count || 0,
      visit_booked: stats.find(s => s._id === 'VISIT_BOOKED')?.count || 0,
      visited: totalVisits,
      re_visit_booked: stats.find(s => s._id === 'RE_VISIT')?.count || 0,
      revisited: totalRevisited,
      visits_today: visitsToday,
      total_visited: totalVisits,
      booked: stats.find(s => s._id === 'BOOKED')?.count || 0,
      not_interested: stats.find(s => s._id === 'NOT_INTERESTED')?.count || 0,
      invalid_number: stats.find(s => s._id === 'INVALID_NUMBER')?.count || 0,
      unassigned_leads: unassignedCount,
    };

    res.json({ success: true, data: formattedStats });
  } catch (error) {
    console.error('[Get Dashboard Stats Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPerUserDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    const { from, to } = req.query;

    // Only admins and superadmins can view per-user stats
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!organization_id || !mongoose.Types.ObjectId.isValid(organization_id as string)) {
      return res.json({ success: true, data: [] });
    }

    const orgId = new mongoose.Types.ObjectId(organization_id as string);
    const matchQuery: any = { organization_id: orgId };

    // Time filter
    if (from && to) {
      matchQuery.created_at = { $gte: new Date(from as string), $lte: new Date(to as string) };
    }

    // Fetch all active users in the org (staff + admin + superadmin)
    const users = await User.find({
      organization_id: orgId,
      role: { $in: ['staff', 'admin', 'superadmin'] },
      status: 'active',
    }).select('name role mobile');

    // Per-user aggregation: count leads by assigned_to + status, plus total visits & revisits
    const perUserAgg = await Lead.aggregate([
      { $match: { ...matchQuery, assigned_to: { $ne: null } } },
      {
        $group: {
          _id: { assigned_to: '$assigned_to', status: '$status' },
          count: { $sum: 1 },
          visits: { $sum: '$visit_count' },
          revisits: { $sum: '$revisit_count' },
        },
      },
    ]);

    // Build result per user
    const userStatsMap: Record<string, any> = {};

    perUserAgg.forEach((row: any) => {
      const userId = row._id.assigned_to.toString();
      const status = row._id.status;
      const count = row.count;
      const visits = row.visits || 0;
      const revisits = row.revisits || 0;

      if (!userStatsMap[userId]) {
        userStatsMap[userId] = {
          NEW: 0, CALLBACK: 0, INTERESTED: 0, VISIT_BOOKED: 0,
          VISITED: 0, RE_VISIT: 0, BOOKED: 0, NOT_INTERESTED: 0, INVALID_NUMBER: 0,
          total_leads: 0,
          total_visits: 0,
          total_revisited: 0,
        };
      }

      userStatsMap[userId][status] = count;
      userStatsMap[userId].total_leads += count;
      userStatsMap[userId].total_visits += visits;
      userStatsMap[userId].total_revisited += revisits;
    });

    // Merge with user names
    const result = users.map((u: any) => {
      const uid = u._id.toString();
      const stats = userStatsMap[uid] || {
        NEW: 0, CALLBACK: 0, INTERESTED: 0, VISIT_BOOKED: 0,
        VISITED: 0, RE_VISIT: 0, BOOKED: 0, NOT_INTERESTED: 0, INVALID_NUMBER: 0,
        total_leads: 0,
        total_visits: 0,
        total_revisited: 0,
      };
      return {
        _id: uid,
        name: u.name,
        role: u.role,
        mobile: u.mobile,
        ...stats,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Get Per-User Dashboard Stats Error]:', error);
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

    if (req.query.statuses) {
      query.status = { $in: (req.query.statuses as string).split(',') };
    } else if (status) {
      query.status = status;
    }
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
    const { status, heat, assigned_to, remark, duplicateFlag, site_visit_booked, site_visit_at, callback_reason, property_status, property_type, preferred_area, not_interested_reason, project, project_id, budget, activity_type, activity_content, visit_notes, visit_projects } = req.body;
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
    if (project_id !== undefined) updateData.project_id = project_id ? new mongoose.Types.ObjectId(project_id) : null;
    if (budget !== undefined) updateData.budget = budget;

    const query: any = { _id: id, organization_id };
    // Only superadmin can update any lead; staff & admin must be assigned to it
    if (req.user?.role !== 'superadmin') {
      query.assigned_to = req.user!.id;
    }

    // Fetch existing lead for visit_history context
    const existingLead = await Lead.findOne(query);
    if (!existingLead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Push visit_history entries when status changes to VISITED — one per project
    if (status === 'VISITED') {
      const projects: string[] = visit_projects?.length
        ? visit_projects
        : [existingLead.project].filter(Boolean);
      const notesMap: Record<string, string> = visit_notes || {};
      const entries = projects.map((proj: string) => ({
        scheduled_at: existingLead.site_visit_at || new Date(),
        completed_at: new Date(),
        outcome: 'completed',
        project: proj,
        notes: notesMap[proj] || null,
        created_at: new Date(),
      }));

      // Per-project revisit detection: check which projects were previously visited
      const prevProjects = new Set(
        (existingLead.visit_history || [])
          .filter(v => v.outcome === 'completed' && v.project)
          .map(v => v.project)
      );
      const revisitCount = projects.filter(p => prevProjects.has(p)).length;

      updateData.$push = { visit_history: { $each: entries } };
      updateData.$inc = { visit_count: entries.length, revisit_count: revisitCount };
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

    let finalUpdate: any;
    if (updateData.$push || updateData.$inc) {
      const { $push, $inc, ...setFields } = updateData;
      finalUpdate = { $set: setFields };
      if ($push) finalUpdate.$push = $push;
      if ($inc) finalUpdate.$inc = $inc;
    } else {
      finalUpdate = { $set: updateData };
    }
    const lead = await Lead.findOneAndUpdate(query, finalUpdate, { new: true });

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

/**
 * GET /leads/week-visits
 * Returns 7-day breakdown of scheduled visits (VISIT_BOOKED + RE_VISIT) for the current week.
 * Week start is determined by org's week_start_day (default 1 = Monday).
 * Accessible to admin & superadmin only.
 */
export const getWeekVisits = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    if (!organization_id || !mongoose.Types.ObjectId.isValid(organization_id as string)) {
      return res.json({ success: true, data: [] });
    }

    // Only managers can see week visits (admin + superadmin)
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const orgId = new mongoose.Types.ObjectId(organization_id as string);

    // Read org preferences; defaults: week_start_day=1 (Mon), tz=330 min (IST)
    const org = await Organization.findById(orgId).select('week_start_day timezone_offset');
    const weekStartDay: number = org?.week_start_day ?? 1;
    const tzOffsetMs: number = (org?.timezone_offset ?? 330) * 60 * 1000; // minutes → ms

    // ── Compute current week range in LOCAL time ──
    // "Today" in local: now.getTime() + tzOffsetMs → UTC date of that instant
    const nowLocal = new Date(Date.now() + tzOffsetMs);
    const todayLocal = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()));

    const currentDayLocal = todayLocal.getUTCDay(); // 0=Sun..6=Sat in local
    const daysBack = (currentDayLocal - weekStartDay + 7) % 7;
    const weekStartLocal = new Date(todayLocal);
    weekStartLocal.setUTCDate(todayLocal.getUTCDate() - daysBack); // midnight Mon local

    const weekEndLocal = new Date(weekStartLocal);
    weekEndLocal.setUTCDate(weekStartLocal.getUTCDate() + 7); // midnight next Mon local

    // Convert local boundaries to UTC for MongoDB query
    const weekStartUtc = new Date(weekStartLocal.getTime() - tzOffsetMs);
    const weekEndUtc = new Date(weekEndLocal.getTime() - tzOffsetMs);

    // ── Fetch all matching leads (no aggregation, group in JS with timezone) ──
    const visits = await Lead.find(
      {
        organization_id: orgId,
        status: { $in: ['VISIT_BOOKED', 'RE_VISIT'] },
        site_visit_at: { $gte: weekStartUtc, $lt: weekEndUtc },
      },
      { site_visit_at: 1 }
    ).lean();

    // Group by local day: for each visit, shift site_visit_at to local, get UTCDay
    const countMap: Record<number, number> = {}; // 0..6 = relative day index in week
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const v of visits) {
      const utcDate = new Date(v.site_visit_at!);
      const localDate = new Date(utcDate.getTime() + tzOffsetMs);
      const localDow = localDate.getUTCDay(); // 0=Sun..6=Sat
      // Map to week index: 0 = weekStartDay, ..., 6 = weekStartDay+6
      const index = ((localDow - weekStartDay + 7) % 7);
      countMap[index] = (countMap[index] || 0) + 1;
    }

    // ── Build 7-day response ──
    const result = [];
    for (let i = 0; i < 7; i++) {
      const dayDateLocal = new Date(weekStartLocal);
      dayDateLocal.setUTCDate(weekStartLocal.getUTCDate() + i);

      const dow = (weekStartDay + i) % 7;
      const count = countMap[i] || 0;
      const dayNum = dayDateLocal.getUTCDate();
      const monthName = dayDateLocal.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

      const isToday =
        dayDateLocal.getUTCFullYear() === todayLocal.getUTCFullYear() &&
        dayDateLocal.getUTCMonth() === todayLocal.getUTCMonth() &&
        dayDateLocal.getUTCDate() === todayLocal.getUTCDate();

      result.push({
        label: DAY_LABELS[dow],
        label_full: DAY_LABELS_FULL[dow],
        day_date: dayDateLocal.toISOString().split('T')[0],
        date_num: dayNum,
        month_short: monthName,
        count,
        is_today: isToday,
        is_weekend: dow === 0 || dow === 6,
      });
    }

    const total = result.reduce((sum, d) => sum + d.count, 0);

    res.json({ success: true, data: { days: result, total, week_start: weekStartUtc.toISOString(), week_end: weekEndUtc.toISOString() } });
  } catch (error) {
    console.error('[Get Week Visits Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
