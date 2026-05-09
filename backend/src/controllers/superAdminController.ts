import { Response } from 'express';
import bcrypt from 'bcrypt';
import Organization from '../models/Organization';
import User from '../models/User';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth';

export const createOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { agencyName, adminName, adminMobile, adminPassword } = req.body;

    if (!agencyName || !adminName || !adminMobile || !adminPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ mobile: adminMobile });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'A user with this mobile already exists' });
    }

    const newOrg = await Organization.create({
      name: agencyName,
      status: 'active'
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const newAdmin = await User.create({
      organization_id: newOrg._id,
      name: adminName,
      mobile: adminMobile,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      must_change_password: true
    });

    res.status(201).json({
      success: true,
      message: 'Organization and Admin created successfully',
      data: {
        organization: newOrg,
        admin: { id: newAdmin._id, name: newAdmin.name, mobile: newAdmin.mobile }
      }
    });

  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ success: false, message: 'Server error while creating organization' });
  }
};

export const getOrganizations = async (req: AuthRequest, res: Response) => {
  try {
    const organizations = await Organization.find().sort({ created_at: -1 });

    // Enrich each org with admin info, staff count, and lead count
    const enriched = await Promise.all(organizations.map(async (org) => {
      const [admin, staffCount, leadCount] = await Promise.all([
        User.findOne({ organization_id: org._id, role: 'admin' }).select('_id name mobile created_at'),
        User.countDocuments({ organization_id: org._id, role: 'staff' }),
        Lead.countDocuments({ organization_id: org._id }),
      ]);

      return {
        _id: org._id,
        name: org.name,
        status: org.status,
        created_at: org.created_at,
        admin: admin ? { _id: admin._id, name: admin.name, mobile: admin.mobile } : null,
        staff_count: staffCount,
        lead_count: leadCount,
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[Get Organizations Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


export const updateOrganizationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const org = await Organization.findByIdAndUpdate(id, { status }, { new: true });
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.json({ success: true, data: org, message: `Organization status updated to ${status}` });
  } catch (error) {
    console.error('[Update Organization Status Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const resetAdminPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'newPassword is required' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findByIdAndUpdate(
      id, 
      { password: hashedPassword, must_change_password: true }, 
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('[Reset Admin Password Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateAdminDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, mobile } = req.body;

    if (!name && !mobile) {
      return res.status(400).json({ success: false, message: 'Name or mobile is required' });
    }

    // If mobile is being changed, check for conflicts
    if (mobile) {
      const existing = await User.findOne({ mobile, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'This mobile number is already in use' });
      }
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (mobile) updates.mobile = mobile;

    const user = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Admin details updated successfully', data: user });
  } catch (error) {
    console.error('[Update Admin Details Error]:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
