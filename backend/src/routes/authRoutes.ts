import { Router } from 'express';
import { forgotSuperAdminPassword, login, resetSuperAdminPassword, updatePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/superadmin/forgot-password', forgotSuperAdminPassword);
router.post('/superadmin/reset-password', resetSuperAdminPassword);
router.patch('/update-password', authenticate, updatePassword);

export default router;
