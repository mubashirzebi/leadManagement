import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

interface AuthRequest extends Request {
  user?: { id: string; organization_id: string; role: string };
}

// GET /api/projects — list projects for the org (with search + pagination)
export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }

    const filter: any = { organization_id: new mongoose.Types.ObjectId(organization_id) };
    if (req.query.status === 'active') {
      filter.status = 'active';
    }

    // Search by name (case-insensitive)
    const search = req.query.search as string;
    if (search && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    const pagination = parsePagination(req.query);
    const total = await Project.countDocuments(filter);
    const projects = await Project.find(filter)
      .sort({ name: 1 })
      .skip(pagination.skip)
      .limit(pagination.size);

    res.json({
      success: true,
      data: projects,
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/projects — create project (admin/superadmin only)
export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    const role = req.user?.role;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }
    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only admins can manage projects' });
    }

    const { name, location, builder, description, configurations } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    const existing = await Project.findOne({
      organization_id: new mongoose.Types.ObjectId(organization_id),
      name: name.trim(),
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A project with this name already exists' });
    }

    const project = await Project.create({
      organization_id: new mongoose.Types.ObjectId(organization_id),
      name: name.trim(),
      location: location?.trim() || null,
      builder: builder?.trim() || null,
      description: description?.trim() || null,
      configurations: Array.isArray(configurations) ? configurations.map((c: any) => ({
        type: c.type?.trim(),
        size: c.size?.trim() || null,
        price: c.price?.trim() || null,
      })).filter((c: any) => c.type) : [],
      status: 'active',
    });

    res.status(201).json({ success: true, data: project, message: 'Project created' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/projects/:id — update project (admin/superadmin only)
export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = req.user?.organization_id;
    const role = req.user?.role;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }
    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only admins can manage projects' });
    }

    const { name, location, builder, description, configurations, status } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (builder !== undefined) updateData.builder = builder?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (configurations !== undefined) {
      updateData.configurations = Array.isArray(configurations)
        ? configurations.map((c: any) => ({
            type: c.type?.trim(),
            size: c.size?.trim() || null,
            price: c.price?.trim() || null,
          })).filter((c: any) => c.type)
        : [];
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, organization_id: new mongoose.Types.ObjectId(organization_id) },
      { $set: updateData },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: project, message: 'Project updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/projects/:id — soft delete (admin/superadmin only)
export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organization_id = req.user?.organization_id;
    const role = req.user?.role;

    if (!organization_id) {
      return res.status(403).json({ success: false, message: 'No organization linked' });
    }
    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only admins can manage projects' });
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, organization_id: new mongoose.Types.ObjectId(organization_id) },
      { $set: { status: 'inactive' } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: project, message: 'Project deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};