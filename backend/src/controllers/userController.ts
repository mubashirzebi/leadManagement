import { Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Lead from '../models/Lead';
import Organization from '../models/Organization';
import { AuthRequest } from '../middleware/auth';

export const getTeamList = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only managers can view assignable team members' });
    }

    if (!organization_id) return res.status(403).json({ success: false, message: 'No org' });
    
    const team = await User.find({ 
      organization_id, 
      role: { $in: ['staff', 'admin'] } 
    }).select('-password').sort({ created_at: -1 }).lean();

    // Fetch lead counts for each team member
    const teamWithStats = await Promise.all(
      team.map(async (member) => {
        const leadsCount = await Lead.countDocuments({ assigned_to: member._id, organization_id });
        const activeLeadsCount = await Lead.countDocuments({
          assigned_to: member._id,
          organization_id,
          status: { $nin: ['INVALID_NUMBER', 'NOT_INTERESTED'] }
        });
        return {
          ...member,
          leadsCount,
          activeLeadsCount
        };
      })
    );

    res.json({ success: true, data: teamWithStats });
  } catch (error) {
    console.error('[Get Team List Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { name, mobile, password, role } = req.body;
    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can create team members' });
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Check if mobile already exists in the same organization
    const existing = await User.findOne({ mobile, organization_id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Mobile number already registered in this organization' });
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

export const updateTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, mobile, status, role } = req.body;
    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only Agency Owners can update team members' });
    }

    const member = await User.findOne({ _id: id, organization_id });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    // Admins cannot change their own role or deactivate themselves to prevent lock-out
    if (member._id.toString() === req.user.id.toString()) {
      if (status === 'inactive') {
        return res.status(400).json({ success: false, message: 'You cannot deactivate yourself' });
      }
      if (role && role !== member.role) {
        return res.status(400).json({ success: false, message: 'You cannot change your own role' });
      }
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (role && ['admin', 'staff'].includes(role)) updates.role = role;
    if (status && ['active', 'inactive'].includes(status)) updates.status = status;

    if (mobile && mobile !== member.mobile) {
      // Check if mobile already exists in the same organization
      const existing = await User.findOne({ mobile, organization_id, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Mobile number already registered in this organization' });
      }
      updates.mobile = mobile;
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    res.json({ success: true, message: 'Team member updated successfully', data: updatedUser });

  } catch (error) {
    console.error('[Update Team Member Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PATCH /users/week-start
 * Superadmin updates the organization's week_start_day (0=Sun..6=Sat, default 1=Mon).
 */
export const updateWeekStart = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;

    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only superadmin can change week start day' });
    }

    if (!organization_id) {
      return res.status(400).json({ success: false, message: 'No organization' });
    }

    const { week_start_day } = req.body;
    if (typeof week_start_day !== 'number' || week_start_day < 0 || week_start_day > 6) {
      return res.status(400).json({ success: false, message: 'week_start_day must be 0 (Sun) to 6 (Sat)' });
    }

    await Organization.findByIdAndUpdate(organization_id, { week_start_day });

    res.json({ success: true, message: 'Week start day updated', data: { week_start_day } });
  } catch (error) {
    console.error('[Update Week Start Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
