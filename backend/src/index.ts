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
import { authenticate } from './middleware/auth';
import { initCronJobs } from './services/reminderService';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', authenticate, superAdminRoutes);
app.use('/api/leads', authenticate, leadRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    initCronJobs();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
