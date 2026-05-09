import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../src/middleware/auth';
import User from '../src/models/User';
import Organization from '../src/models/Organization';

const app = express();
app.use(express.json());

app.get('/protected', authenticate, (req, res) => {
  res.status(200).json({ success: true, user: (req as any).user });
});

describe('Auth Middleware - Kill Switch', () => {
  let suspendedOrgId: any;
  let activeOrgId: any;
  let userId: any;
  const SECRET = process.env.JWT_SECRET || 'fallback_secret';

  beforeEach(async () => {
    const suspendedOrg = await Organization.create({ name: 'Suspended Agency', status: 'suspended' });
    const activeOrg = await Organization.create({ name: 'Active Agency', status: 'active' });
    suspendedOrgId = suspendedOrg._id;
    activeOrgId = activeOrg._id;

    const user = await User.create({
      organization_id: suspendedOrgId,
      name: 'Test Staff',
      mobile: '1234567890',
      password: 'hashed_password',
      role: 'staff'
    });
    userId = user._id;
  });

  it('should return 403 if the user organization is suspended', async () => {
    const token = jwt.sign({ id: userId, role: 'staff', organization_id: suspendedOrgId }, SECRET);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/suspended/i);
  });

  it('should allow access if the organization is active', async () => {
    await User.findByIdAndUpdate(userId, { organization_id: activeOrgId });
    const token = jwt.sign({ id: userId, role: 'staff', organization_id: activeOrgId }, SECRET);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
