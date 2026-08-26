import app from './app';
import prisma from './config/db';
import { logger } from './config/logger';

const PORT = process.env.PORT || 3000;

const cleanupCache = async () => {
  try {
    const ttlHours = parseInt(process.env.CACHE_TTL_HOURS || '24');
    await prisma.$executeRaw`
      DELETE FROM "CacheEntry"
      WHERE "createdAt" < NOW() - INTERVAL '1 hour' * ${ttlHours};
    `;
    logger.info('Cache cleanup completed');
  } catch (error) {
    logger.error({ err: error }, 'Failed to cleanup cache');
  }
};

setInterval(cleanupCache, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  cleanupCache();
});
