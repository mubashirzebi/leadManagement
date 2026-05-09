import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import leadRoutes from '../src/routes/leadRoutes';
import { authenticate } from '../src/middleware/auth';
import Organization from '../src/models/Organization';
import User from '../src/models/User';
import Lead from '../src/models/Lead';

const app = express();
app.use(express.json());
app.use('/api/leads', authenticate, leadRoutes);

describe('Leads API', () => {
  const SECRET = process.env.JWT_SECRET || 'fallback_secret';
  let orgId: any;
  let adminToken: string;
  let staffId: any;

  beforeEach(async () => {
    const org = await Organization.create({ name: 'Lead Agency' });
    orgId = org._id;

    const admin = await User.create({ name: 'Admin', mobile: 'admin', password: 'hash', role: 'admin', organization_id: orgId });
    const staff = await User.create({ name: 'Staff', mobile: 'staff', password: 'hash', role: 'staff', organization_id: orgId });
    
    adminToken = jwt.sign({ id: admin._id, role: 'admin', organization_id: orgId }, SECRET);
    staffId = staff._id;
  });

  it('should create a manual lead', async () => {
    const response = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Manual Lead', mobile: '999888777' });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Manual Lead');
  });

  it('should bulk assign leads to a staff member', async () => {
    const lead1 = await Lead.create({ organization_id: orgId, name: 'L1', mobile: '11' });
    const lead2 = await Lead.create({ organization_id: orgId, name: 'L2', mobile: '22' });

    const response = await request(app)
      .patch('/api/leads/bulk-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadIds: [lead1._id, lead2._id],
        staffId: staffId
      });

    expect(response.status).toBe(200);

    const updatedLead = await Lead.findById(lead1._id);
    expect(updatedLead?.assigned_to?.toString()).toBe(staffId.toString());
  });
});
