/*
  Warnings:

  - A unique constraint covering the columns `[promptHash,apiKeyId]` on the table `CacheEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CacheEntry_promptHash_key";

-- CreateIndex
CREATE UNIQUE INDEX "CacheEntry_promptHash_apiKeyId_key" ON "CacheEntry"("promptHash", "apiKeyId");
