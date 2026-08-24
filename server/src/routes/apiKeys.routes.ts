import { Router } from 'express';
import { generateKey, listKeys, revokeKey } from '../modules/apiKeys';
import { authenticateJWT } from '../middleware/auth';
const router = Router();
router.use(authenticateJWT);
router.post('/', generateKey);
router.get('/', listKeys);
router.delete('/:id', revokeKey);
export default router;
