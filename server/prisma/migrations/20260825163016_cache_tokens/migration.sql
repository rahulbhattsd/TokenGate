-- AlterTable
ALTER TABLE "CacheEntry" ADD COLUMN     "inputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "outputTokens" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN     "purpose" TEXT;
