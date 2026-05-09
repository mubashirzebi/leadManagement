import { Router } from 'express';
import { handleIncomingWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/incoming', handleIncomingWebhook);

export default router;
