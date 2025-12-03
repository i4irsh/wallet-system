import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQConfig } from './rabbitmq.config';

export interface RabbitMQModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<RabbitMQConfig> | RabbitMQConfig;
  inject?: any[];
}

@Global()
@Module({})
export class RabbitMQModule {
  static forRoot(config: RabbitMQConfig): DynamicModule {
    return {
      module: RabbitMQModule,
      providers: [
        {
          provide: 'RABBITMQ_CONFIG',
          useValue: config,
        },
        RabbitMQService,
      ],
      exports: [RabbitMQService],
    };
  }

  static forRootAsync(options: RabbitMQModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    return {
      module: RabbitMQModule,
      providers: [...asyncProviders, RabbitMQService],
      exports: [RabbitMQService],
    };
  }

  private static createAsyncProviders(options: RabbitMQModuleAsyncOptions): Provider[] {
    return [
      {
        provide: 'RABBITMQ_CONFIG',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];
  }
}
