import { Router } from 'express';
import { forgotSuperAdminPassword, login, resetSuperAdminPassword, updatePassword, updateMyOrganization, exchangeMetaToken, getMyOrganization } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/superadmin/forgot-password', forgotSuperAdminPassword);
router.post('/superadmin/reset-password', resetSuperAdminPassword);
router.patch('/update-password', authenticate, updatePassword);
router.get('/organization', authenticate, getMyOrganization);
router.patch('/organization', authenticate, updateMyOrganization);
router.post('/meta/exchange', authenticate, exchangeMetaToken);

export default router;
