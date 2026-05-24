import { Router } from 'express';
import { connectMeta, fetchMetaPages, linkMetaPage, unlinkMetaPage } from '../controllers/integrationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/meta/connect', authenticate, connectMeta);
router.post('/meta/pages', authenticate, fetchMetaPages);
router.post('/meta/link', authenticate, linkMetaPage);
router.post('/meta/unlink', authenticate, unlinkMetaPage);

export default router;
