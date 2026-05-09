import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { authenticate } from '../src/middleware/auth';
import authRoutes from '../src/routes/authRoutes';
import User from '../src/models/User';
import Organization from '../src/models/Organization';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

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

  it('should send a SuperAdmin password reset token for a known email', async () => {
    const hashedPassword = await bcrypt.hash('super-secret', 10);
    await User.create({
      name: 'Platform Owner',
      email: 'owner@example.com',
      mobile: '7777777777',
      password: hashedPassword,
      role: 'superadmin',
      organization_id: null,
      must_change_password: false
    });

    const response = await request(app)
      .post('/api/auth/superadmin/forgot-password')
      .send({ email: 'owner@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.resetToken).toMatch(/^\d{6}$/);

    const updatedUser = await User.findOne({ email: 'owner@example.com' });
    expect(updatedUser?.reset_password_token_hash).toBeTruthy();
    expect(updatedUser?.reset_password_expires_at).toBeTruthy();
  });

  it('should not expose whether a non-SuperAdmin email exists in forgot password', async () => {
    const hashedPassword = await bcrypt.hash('admin-secret', 10);
    await User.create({
      name: 'Agency Admin',
      email: 'admin@example.com',
      mobile: '6666666666',
      password: hashedPassword,
      role: 'admin',
      organization_id: activeOrgId,
      must_change_password: false
    });

    const response = await request(app)
      .post('/api/auth/superadmin/forgot-password')
      .send({ email: 'admin@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeUndefined();

    const updatedUser = await User.findOne({ email: 'admin@example.com' });
    expect(updatedUser?.reset_password_token_hash).toBeNull();
  });

  it('should reset the SuperAdmin password with a valid token', async () => {
    const oldPassword = await bcrypt.hash('old-password', 10);
    await User.create({
      name: 'Platform Owner',
      email: 'reset@example.com',
      mobile: '5555555555',
      password: oldPassword,
      role: 'superadmin',
      organization_id: null,
      must_change_password: true
    });

    const forgotResponse = await request(app)
      .post('/api/auth/superadmin/forgot-password')
      .send({ email: 'reset@example.com' });

    const resetToken = forgotResponse.body.data.resetToken;

    const resetResponse = await request(app)
      .post('/api/auth/superadmin/reset-password')
      .send({
        email: 'reset@example.com',
        token: resetToken,
        newPassword: 'new-password'
      });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.success).toBe(true);

    const updatedUser = await User.findOne({ email: 'reset@example.com' });
    expect(updatedUser?.must_change_password).toBe(false);
    expect(updatedUser?.reset_password_token_hash).toBeNull();
    expect(updatedUser?.reset_password_expires_at).toBeNull();
    expect(await bcrypt.compare('new-password', updatedUser?.password as string)).toBe(true);
  });
});
