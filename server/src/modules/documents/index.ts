import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { logger } from '../../config/logger';
import { embedTexts } from '../embeddings';
import { chunkTextParts } from './chunking';
import { extractDocumentText, validateUpload } from './extract';

export interface IngestDocumentResult {
  document: {
    id: string;
    name: string;
    status: string;
    contentHash: string | null;
  };
  duplicate: boolean;
  chunksCreated: number;
  embeddingTokens: number;
  embeddingCostUsd: number;
}

const hashContent = (content: string) => crypto.createHash('sha256').update(content).digest('hex');

export const ensureKnowledgeBaseOwner = async (knowledgeBaseId: string, userId: string) => {
  const knowledgeBase = await prisma.knowledgeBase.findFirst({
    where: { id: knowledgeBaseId, userId },
  });
  if (!knowledgeBase) {
    const error = new Error('Knowledge base not found');
    (error as any).statusCode = 404;
    throw error;
  }
  return knowledgeBase;
};

export const ingestUploadedDocument = async (
  knowledgeBaseId: string,
  userId: string,
  file: Express.Multer.File
): Promise<IngestDocumentResult> => {
  await ensureKnowledgeBaseOwner(knowledgeBaseId, userId);
  const upload = validateUpload(file);

  const document = await prisma.document.create({
    data: {
      knowledgeBaseId,
      name: upload.normalizedName,
      source: upload.normalizedName,
      mimeType: file.mimetype,
      status: 'processing',
      metadata: {
        sizeBytes: file.size,
        extension: upload.extension,
      },
    },
  });

  try {
    const extracted = await extractDocumentText(file);
    const contentHash = hashContent(extracted.text);
    const duplicate = await prisma.document.findFirst({
      where: {
        id: { not: document.id },
        knowledgeBaseId,
        contentHash,
      },
    });

    if (duplicate) {
      await prisma.document.delete({ where: { id: document.id } });
      return {
        document: {
          id: duplicate.id,
          name: duplicate.name,
          status: duplicate.status,
          contentHash: duplicate.contentHash,
        },
        duplicate: true,
        chunksCreated: 0,
        embeddingTokens: 0,
        embeddingCostUsd: 0,
      };
    }

    const chunks = chunkTextParts(extracted.parts, {
      baseMetadata: {
        documentName: extracted.normalizedName,
        source: extracted.normalizedName,
        mimeType: file.mimetype,
      },
    });

    if (chunks.length === 0) {
      throw new Error('Document produced no non-empty chunks');
    }

    const embeddings = await embedTexts(chunks.map(chunk => chunk.content));
    if (embeddings.embeddings.length !== chunks.length) {
      throw new Error('Embedding count did not match chunk count');
    }

    await prisma.$transaction(async tx => {
      await tx.documentChunk.deleteMany({ where: { documentId: document.id } });
      await tx.document.update({
        where: { id: document.id },
        data: {
          contentHash,
          status: 'ready',
          errorMessage: null,
          metadata: {
            sizeBytes: file.size,
            extension: extracted.extension,
            chunkCount: chunks.length,
          },
        },
      });

      const values = chunks.map((chunk, index) => Prisma.sql`(
        ${crypto.randomUUID()},
        ${document.id},
        ${chunk.content},
        ${chunk.chunkIndex},
        ${chunk.tokenCount},
        ${JSON.stringify(chunk.metadata)}::jsonb,
        ${embeddings.embeddings[index]}::vector,
        NOW()
      )`);

      await tx.$executeRaw`
        INSERT INTO "DocumentChunk" ("id", "documentId", "content", "chunkIndex", "tokenCount", "metadata", "embedding", "createdAt")
        VALUES ${Prisma.join(values)}
      `;

      await tx.knowledgeBase.update({
        where: { id: knowledgeBaseId },
        data: { version: { increment: 1 } },
      });
    });

    return {
      document: {
        id: document.id,
        name: document.name,
        status: 'ready',
        contentHash,
      },
      duplicate: false,
      chunksCreated: chunks.length,
      embeddingTokens: embeddings.tokens,
      embeddingCostUsd: embeddings.costUsd,
    };
  } catch (error: any) {
    const message = error?.message || 'Document ingestion failed';
    await prisma.documentChunk.deleteMany({ where: { documentId: document.id } }).catch(() => undefined);
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'failed', errorMessage: message },
    }).catch(updateError => logger.error({ err: updateError, documentId: document.id }, 'Failed to mark document failed'));
    logger.error({ err: error, documentId: document.id, knowledgeBaseId }, 'Document ingestion failed');
    throw error;
  }
};
