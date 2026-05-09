import { Router } from 'express';
import { createReminder } from '../controllers/reminderController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, createReminder);

export default router;
