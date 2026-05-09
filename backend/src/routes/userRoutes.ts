import { Router } from 'express';
import { getStaff } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/staff', authenticate, getStaff);

export default router;
