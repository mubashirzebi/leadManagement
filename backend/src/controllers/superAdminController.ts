import { Response } from 'express';
import bcrypt from 'bcrypt';
import Organization from '../models/Organization';
import User from '../models/User';
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
    res.json({ success: true, data: organizations });
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
