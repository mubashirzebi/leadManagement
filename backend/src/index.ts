import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import leadRoutes from './routes/leadRoutes';
import webhookRoutes from './routes/webhookRoutes';
import reminderRoutes from './routes/reminderRoutes';
import userRoutes from './routes/userRoutes';
import integrationRoutes from './routes/integrationRoutes';
import { authenticate } from './middleware/auth';
import { initCronJobs } from './services/reminderService';
import { initMetaSyncCron } from './services/metaSyncService';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', authenticate, superAdminRoutes);
app.use('/api/leads', authenticate, leadRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/integrations', integrationRoutes);

app.use('/api/webhooks', (req, res, next) => {
  console.log(`\n--- [WEBHOOK RECEIVED] ${req.method} ${req.url} ---`);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  console.log('-------------------------------------------\n');
  next();
}, webhookRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Safely drop the unique index on leads collection if it exists
    try {
      const db = mongoose.connection.db;
      if (db) {
        const collections = await db.listCollections({ name: 'leads' }).toArray();
        if (collections.length > 0) {
          await db.collection('leads').dropIndex('mobile_1_organization_id_1');
          console.log('[Startup] Safely dropped unique index mobile_1_organization_id_1 to support duplicates.');
        }
      }
    } catch (indexErr: any) {
      // If it doesn't exist, ignore the error
      console.log('[Startup] Unique index drop check (harmless if already deleted):', indexErr.message);
    }

    initCronJobs();
    initMetaSyncCron();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
