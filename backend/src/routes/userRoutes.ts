import { Router } from 'express';
import { getTeamList, createTeamMember } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getTeamList);
router.post('/', authenticate, createTeamMember);

export default router;
