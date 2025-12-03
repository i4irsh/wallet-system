import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyConfig } from './idempotency.config';

export interface IdempotencyModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<IdempotencyConfig> | IdempotencyConfig;
  inject?: any[];
}

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

  static forRootAsync(options: IdempotencyModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    return {
      module: IdempotencyModule,
      providers: [...asyncProviders, IdempotencyService],
      exports: [IdempotencyService],
    };
  }

  private static createAsyncProviders(options: IdempotencyModuleAsyncOptions): Provider[] {
    return [
      {
        provide: 'IDEMPOTENCY_CONFIG',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];
  }
}
