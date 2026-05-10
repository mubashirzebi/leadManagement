import { Router } from 'express';
import { handleIncomingWebhook, verifyMetaWebhook, handleMetaLead, handleGoogleLead } from '../controllers/webhookController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/incoming', handleIncomingWebhook);
router.post('/incoming/self', authenticate, handleIncomingWebhook);

// Meta (Facebook/Instagram)
router.get('/meta', verifyMetaWebhook);
router.post('/meta', handleMetaLead);

// Google Ads
router.post('/google', handleGoogleLead);

export default router;
