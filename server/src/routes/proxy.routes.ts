import { Router } from 'express';
import { handleProxyRequest } from '../modules/proxy';
import { authenticateApiKey } from '../middleware/apiKeyAuth';
import { rateLimiter } from '../middleware/rateLimiter';
const router = Router();
router.use(authenticateApiKey);
router.post('/chat/completions', rateLimiter, handleProxyRequest);
export default router;
