// Idempotency constants
export const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours
export const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';

export interface IdempotencyConfig {
  host: string;
  port: number;
  ttlSeconds: number;
  keyPrefix: string;
}
