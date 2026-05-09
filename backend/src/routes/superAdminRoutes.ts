import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/auth';
import { 
  createOrganization, 
  getOrganizations, 
  updateOrganizationStatus, 
  resetAdminPassword,
  updateAdminDetails
} from '../controllers/superAdminController';

const router = Router();
router.use(requireSuperAdmin);

router.get('/organizations', getOrganizations);
router.post('/organizations', createOrganization);
router.patch('/organizations/:id/status', updateOrganizationStatus);
router.patch('/users/:id/reset-password', resetAdminPassword);
router.patch('/users/:id', updateAdminDetails);

export default router;
