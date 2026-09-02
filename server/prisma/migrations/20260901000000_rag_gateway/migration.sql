-- Keep existing installs safe when earlier local schema drift already added columns.
CREATE EXTENSION IF NOT EXISTS "vector";

ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "spendUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

ALTER TABLE "RequestLog"
  ADD COLUMN IF NOT EXISTS "ragEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "knowledgeBaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "chunksRetrieved" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "chunksUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ragTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tokensDiscarded" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "retrievalLatencyMs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "embeddingTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "embeddingCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "llmCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

ALTER TABLE "CacheEntry"
  ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cacheScopeHash" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "ragEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "knowledgeBaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "knowledgeBaseVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "ragMetadata" JSONB;

DROP INDEX IF EXISTS "CacheEntry_promptHash_key";
DROP INDEX IF EXISTS "CacheEntry_promptHash_apiKeyId_key";
DROP INDEX IF EXISTS "CacheEntry_promptHash_apiKeyId_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CacheEntry_promptHash_apiKeyId_userId_cacheScopeHash_key"
  ON "CacheEntry"("promptHash", "apiKeyId", "userId", "cacheScopeHash");

CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "source" TEXT,
  "mimeType" TEXT,
  "contentHash" TEXT,
  "metadata" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeBase_userId_idx" ON "KnowledgeBase"("userId");
CREATE INDEX IF NOT EXISTS "Document_knowledgeBaseId_idx" ON "Document"("knowledgeBaseId");
CREATE UNIQUE INDEX IF NOT EXISTS "Document_knowledgeBaseId_contentHash_key" ON "Document"("knowledgeBaseId", "contentHash");
CREATE INDEX IF NOT EXISTS "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_idx" ON "DocumentChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeBase_userId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeBase"
      ADD CONSTRAINT "KnowledgeBase_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Document_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "Document"
      ADD CONSTRAINT "Document_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DocumentChunk_documentId_fkey'
  ) THEN
    ALTER TABLE "DocumentChunk"
      ADD CONSTRAINT "DocumentChunk_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
