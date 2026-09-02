import { Redis } from 'ioredis';
import { logger } from './logger';

let redisClient: Redis | null = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    redisClient.on('error', (error) => {
      logger.warn({ err: error }, 'Redis connection error');
    });
  }
  return redisClient;
};

const redis = new Proxy({} as Redis, {
  get(_target, property) {
    const client = getRedisClient();
    const value = (client as any)[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default redis;
