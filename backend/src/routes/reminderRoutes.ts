import { Router } from 'express';
import { createReminder, deleteRemindersByLead } from '../controllers/reminderController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.delete('/', authenticate, deleteRemindersByLead);
router.post('/', authenticate, createReminder);

export default router;
