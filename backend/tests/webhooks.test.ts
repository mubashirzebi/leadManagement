import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import webhookRoutes from '../src/routes/webhookRoutes';
import Organization from '../src/models/Organization';
import Lead from '../src/models/Lead';

const app = express();
app.use(express.json());
app.use('/api/webhooks', webhookRoutes);

describe('Webhooks API', () => {
  it('should create a lead from a webhook if valid org_id is provided', async () => {
    const org = await Organization.create({ name: 'Webhook Agency' });

    const response = await request(app)
      .post(`/api/webhooks/incoming?key=${org._id}`)
      .send({
        name: 'John Meta',
        mobile: '5551234567',
        source: 'Meta Ads',
        project: 'Luxury Villas'
      });

    expect(response.status).toBe(201);
    
    const lead = await Lead.findOne({ mobile: '5551234567' });
    expect(lead).toBeTruthy();
    expect(lead?.organization_id.toString()).toBe(org._id.toString());
    expect(lead?.source).toBe('Meta Ads');
    expect(lead?.assigned_to).toBeNull(); // Goes to Unassigned Queue
  });

  it('should reject webhook if org_id is invalid', async () => {
    const response = await request(app)
      .post('/api/webhooks/incoming?key=invalid_id')
      .send({ name: 'Jane Meta', mobile: '1111' });

    expect(response.status).toBe(400); // Or 404
  });
});
