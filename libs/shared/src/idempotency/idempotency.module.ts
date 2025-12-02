import { Module, DynamicModule, Global } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyConfig } from './idempotency.config';

@Global()
@Module({})
export class IdempotencyModule {
  static forRoot(config: IdempotencyConfig): DynamicModule {
    return {
      module: IdempotencyModule,
      providers: [
        {
          provide: 'IDEMPOTENCY_CONFIG',
          useValue: config,
        },
        IdempotencyService,
      ],
      exports: [IdempotencyService],
    };
  }
}