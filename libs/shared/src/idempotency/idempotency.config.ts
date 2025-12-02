export interface IdempotencyConfig {
  host: string;
  port: number;
  ttlSeconds: number;
  keyPrefix: string;
}

export const getIdempotencyConfig = (): IdempotencyConfig => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT!, 10) || 6379,
  ttlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS!, 10) || 86400, // 24 hours
  keyPrefix: 'idempotency:',
});
