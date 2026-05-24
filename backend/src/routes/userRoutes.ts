import { Router } from 'express';
import { getTeamList, createTeamMember, updateTeamMember } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getTeamList);
router.post('/', authenticate, createTeamMember);
router.put('/:id', authenticate, updateTeamMember);

export default router;
