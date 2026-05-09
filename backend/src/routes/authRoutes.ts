import { Router } from 'express';
import { login, updatePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.patch('/update-password', authenticate, updatePassword);

export default router;
