import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getProjects, createProject, updateProject, deleteProject } from '../controllers/projectController';

const router = Router();

router.get('/', authenticate, getProjects);
router.post('/', authenticate, createProject);
router.put('/:id', authenticate, updateProject);
router.delete('/:id', authenticate, deleteProject);

export default router;