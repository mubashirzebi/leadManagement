import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import superAdminRoutes from '../src/routes/superAdminRoutes';
import { authenticate } from '../src/middleware/auth';
import Organization from '../src/models/Organization';
import User from '../src/models/User';

const app = express();
app.use(express.json());
app.use('/api/superadmin', authenticate, superAdminRoutes);

describe('SuperAdmin API', () => {
  const SECRET = process.env.JWT_SECRET || 'fallback_secret';

  it('should reject non-superadmin users with 403', async () => {
    const org = await Organization.create({ name: 'Valid Org' });
    const user = await User.create({ name: 'Admin', mobile: '999', password: 'hash', role: 'admin', organization_id: org._id });
    const token = jwt.sign({ id: user._id, role: 'admin', organization_id: org._id }, SECRET);

    const response = await request(app)
      .post('/api/superadmin/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ agencyName: 'Test Agency', adminName: 'Admin', adminMobile: '111', adminPassword: 'pass' });

    expect(response.status).toBe(403);
  });

  it('should successfully create an organization and owner admin', async () => {
    const token = jwt.sign({ id: 'super_dummy', role: 'superadmin', organization_id: null }, SECRET);

    const response = await request(app)
      .post('/api/superadmin/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ agencyName: 'Test Agency', adminName: 'Admin', adminMobile: '111', adminPassword: 'pass' });

    // Since we haven't implemented this yet, this test MUST fail! (TDD Rule)
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const org = await Organization.findOne({ name: 'Test Agency' });
    expect(org).toBeTruthy();

    const admin = await User.findOne({ mobile: '111' });
    expect(admin).toBeTruthy();
    expect(admin?.role).toBe('admin');
  });

  it('should list all organizations', async () => {
    const token = jwt.sign({ id: 'super_dummy', role: 'superadmin', organization_id: null }, SECRET);
    await Organization.create([{ name: 'Org 1' }, { name: 'Org 2' }]);

    const response = await request(app)
      .get('/api/superadmin/organizations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should update organization status (Suspend/Activate)', async () => {
    const token = jwt.sign({ id: 'super_dummy', role: 'superadmin', organization_id: null }, SECRET);
    const org = await Organization.create({ name: 'To Suspend', status: 'active' });

    const response = await request(app)
      .patch(`/api/superadmin/organizations/${org._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'suspended' });

    expect(response.status).toBe(200);
    const updatedOrg = await Organization.findById(org._id);
    expect(updatedOrg?.status).toBe('suspended');
  });

  it('should force reset an admin password', async () => {
    const token = jwt.sign({ id: 'super_dummy', role: 'superadmin', organization_id: null }, SECRET);
    const org = await Organization.create({ name: 'Reset Org' });
    const user = await User.create({ name: 'Admin', mobile: '888', password: 'old', role: 'admin', organization_id: org._id });

    const response = await request(app)
      .patch(`/api/superadmin/users/${user._id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'new_secured_password' });

    expect(response.status).toBe(200);
    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.must_change_password).toBe(true);
  });
});
