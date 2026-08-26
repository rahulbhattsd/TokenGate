/*
  Warnings:

  - Added the required column `apiKeyId` to the `CacheEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CacheEntry" ADD COLUMN     "apiKeyId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "CacheEntry" ADD CONSTRAINT "CacheEntry_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
