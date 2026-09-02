import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth';
import {
  createKnowledgeBase,
  deleteDocument,
  deleteKnowledgeBase,
  getDocument,
  getKnowledgeBase,
  listDocuments,
  listKnowledgeBases,
  searchKnowledgeBase,
  updateKnowledgeBase,
  uploadDocument,
} from '../modules/knowledgeBases';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: parseInt(process.env.RAG_MAX_FILE_BYTES || `${10 * 1024 * 1024}`),
  },
});

const uploadSingleDocument = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
      return;
    }

    res.status(400).json({ error: 'Invalid upload' });
  });
};

router.use(authenticateJWT);

router.post('/', createKnowledgeBase);
router.get('/', listKnowledgeBases);
router.get('/:id', getKnowledgeBase);
router.patch('/:id', updateKnowledgeBase);
router.delete('/:id', deleteKnowledgeBase);

router.post('/:id/documents', uploadSingleDocument, uploadDocument);
router.get('/:id/documents', listDocuments);
router.get('/:id/documents/:documentId', getDocument);
router.delete('/:id/documents/:documentId', deleteDocument);
router.post('/:id/search', searchKnowledgeBase);

export default router;
