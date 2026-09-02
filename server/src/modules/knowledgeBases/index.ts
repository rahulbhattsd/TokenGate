import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/db';
import { logger } from '../../config/logger';
import { ingestUploadedDocument, ensureKnowledgeBaseOwner } from '../documents';
import { retrieveRagContext } from '../rag';

const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(20).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  maxContextTokens: z.number().int().min(1).max(20000).optional(),
});

const handleError = (res: Response, error: unknown, message: string) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.errors });
    return;
  }
  const statusCode = (error as any)?.statusCode || 500;
  logger.error({ err: error }, message);
  res.status(statusCode).json({ error: statusCode === 404 ? 'Not found' : 'Error' });
};

export const createKnowledgeBase = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createKnowledgeBaseSchema.parse(req.body);
    const knowledgeBase = await prisma.knowledgeBase.create({
      data: { userId: req.userId!, ...body },
    });
    res.status(201).json(knowledgeBase);
  } catch (error) {
    handleError(res, error, 'Failed to create knowledge base');
  }
};

export const listKnowledgeBases = async (req: Request, res: Response): Promise<void> => {
  try {
    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: { userId: req.userId! },
      include: {
        _count: { select: { documents: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(knowledgeBases);
  } catch (error) {
    handleError(res, error, 'Failed to list knowledge bases');
  }
};

export const getKnowledgeBase = async (req: Request, res: Response): Promise<void> => {
  try {
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { chunks: true } } },
        },
      },
    });
    if (!knowledgeBase) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(knowledgeBase);
  } catch (error) {
    handleError(res, error, 'Failed to get knowledge base');
  }
};

export const updateKnowledgeBase = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureKnowledgeBaseOwner(req.params.id, req.userId!);
    const body = updateKnowledgeBaseSchema.parse(req.body);
    const knowledgeBase = await prisma.knowledgeBase.update({
      where: { id: req.params.id },
      data: {
        ...body,
        version: { increment: 1 },
      },
    });
    res.json(knowledgeBase);
  } catch (error) {
    handleError(res, error, 'Failed to update knowledge base');
  }
};

export const deleteKnowledgeBase = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureKnowledgeBaseOwner(req.params.id, req.userId!);
    await prisma.knowledgeBase.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    handleError(res, error, 'Failed to delete knowledge base');
  }
};

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'File is required' });
      return;
    }
    const result = await ingestUploadedDocument(req.params.id, req.userId!, req.file);
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    handleError(res, error, 'Failed to upload document');
  }
};

export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureKnowledgeBaseOwner(req.params.id, req.userId!);
    const documents = await prisma.document.findMany({
      where: { knowledgeBaseId: req.params.id },
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(documents);
  } catch (error) {
    handleError(res, error, 'Failed to list documents');
  }
};

export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureKnowledgeBaseOwner(req.params.id, req.userId!);
    const document = await prisma.document.findFirst({
      where: { id: req.params.documentId, knowledgeBaseId: req.params.id },
      include: { _count: { select: { chunks: true } } },
    });
    if (!document) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(document);
  } catch (error) {
    handleError(res, error, 'Failed to get document');
  }
};

export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureKnowledgeBaseOwner(req.params.id, req.userId!);
    const document = await prisma.document.findFirst({
      where: { id: req.params.documentId, knowledgeBaseId: req.params.id },
    });
    if (!document) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await prisma.$transaction([
      prisma.document.delete({ where: { id: document.id } }),
      prisma.knowledgeBase.update({
        where: { id: req.params.id },
        data: { version: { increment: 1 } },
      }),
    ]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    handleError(res, error, 'Failed to delete document');
  }
};

export const searchKnowledgeBase = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = searchSchema.parse(req.body);
    const result = await retrieveRagContext(req.userId!, {
      enabled: true,
      knowledgeBaseId: req.params.id,
      topK: body.topK,
      similarityThreshold: body.similarityThreshold,
      maxContextTokens: body.maxContextTokens,
    }, body.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to search knowledge base');
  }
};
