import { Router } from 'express';
import { getTeamList, createTeamMember, updateTeamMember, updateWeekStart } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getTeamList);
router.post('/', authenticate, createTeamMember);
router.put('/:id', authenticate, updateTeamMember);
router.patch('/week-start', authenticate, updateWeekStart);

export default router;
