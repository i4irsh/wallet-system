import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import type { IdempotencyConfig } from './idempotency.config';

export enum IdempotencyStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export interface IdempotencyRecord {
  status: IdempotencyStatus;
  response?: any;
  createdAt: string;
  completedAt?: string;
}

@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(@Inject('IDEMPOTENCY_CONFIG') private readonly config: IdempotencyConfig) {
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis error', error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private getKey(idempotencyKey: string): string {
    return `${this.config.keyPrefix}${idempotencyKey}`;
  }

  /**
   * Check if request is duplicate and try to acquire lock
   * Returns:
   * - { isDuplicate: false } if this is a new request (lock acquired)
   * - { isDuplicate: true, status: 'IN_PROGRESS' } if request is being processed
   * - { isDuplicate: true, status: 'COMPLETED', response } if request was already completed
   */
  async checkAndLock(idempotencyKey: string): Promise<{
    isDuplicate: boolean;
    status?: IdempotencyStatus;
    response?: any;
  }> {
    const key = this.getKey(idempotencyKey);

    // Try to get existing record
    const existing = await this.redis.get(key);

    if (existing) {
      const record: IdempotencyRecord = JSON.parse(existing);
      this.logger.debug(`Found existing idempotency record: ${record.status}`);

      return {
        isDuplicate: true,
        status: record.status,
        response: record.response,
      };
    }

    // Try to acquire lock using SET NX (only set if not exists)
    const record: IdempotencyRecord = {
      status: IdempotencyStatus.IN_PROGRESS,
      createdAt: new Date().toISOString(),
    };

    const acquired = await this.redis.set(key, JSON.stringify(record), 'EX', this.config.ttlSeconds, 'NX');

    if (acquired) {
      this.logger.debug(`Acquired idempotency lock for key: ${idempotencyKey}`);
      return { isDuplicate: false };
    }

    // Lock was acquired by another process between our GET and SET
    // Re-fetch to get the current state
    const current = await this.redis.get(key);
    if (current) {
      const currentRecord: IdempotencyRecord = JSON.parse(current);
      return {
        isDuplicate: true,
        status: currentRecord.status,
        response: currentRecord.response,
      };
    }

    // Edge case: record expired between operations, treat as new
    return { isDuplicate: false };
  }

  /**
   * Mark request as completed and store response
   */
  async complete(idempotencyKey: string, response: any): Promise<void> {
    const key = this.getKey(idempotencyKey);

    const record: IdempotencyRecord = {
      status: IdempotencyStatus.COMPLETED,
      response,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    await this.redis.set(key, JSON.stringify(record), 'EX', this.config.ttlSeconds);

    this.logger.debug(`Marked idempotency key as completed: ${idempotencyKey}`);
  }

  /**
   * Remove lock if processing failed (allow retry)
   */
  async release(idempotencyKey: string): Promise<void> {
    const key = this.getKey(idempotencyKey);
    await this.redis.del(key);
    this.logger.debug(`Released idempotency lock: ${idempotencyKey}`);
  }

  /**
   * Check if key exists
   */
  async exists(idempotencyKey: string): Promise<boolean> {
    const key = this.getKey(idempotencyKey);
    const result = await this.redis.exists(key);
    return result === 1;
  }
}
