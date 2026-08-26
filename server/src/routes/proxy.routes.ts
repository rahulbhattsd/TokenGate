import { Router } from 'express';
import { handleProxyRequest } from '../modules/proxy';
import { authenticateApiKey } from '../middleware/apiKeyAuth';
const router = Router();
router.use(authenticateApiKey);
router.post('/chat/completions', handleProxyRequest);
export default router;
