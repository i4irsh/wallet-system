import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  IdempotencyModule,
  IdempotencyGuard,
  IdempotencyInterceptor,
  apiGatewayConfigSchema,
  ENV,
  IDEMPOTENCY_TTL_SECONDS,
  IDEMPOTENCY_KEY_PREFIX,
  MICROSERVICE_TOKENS,
} from '@app/shared';
import { ApiGatewayController } from './api-gateway.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: apiGatewayConfigSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    ClientsModule.registerAsync([
      {
        name: MICROSERVICE_TOKENS.COMMAND_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>(ENV.COMMAND_SERVICE_HOST),
            port: configService.get<number>(ENV.COMMAND_SERVICE_PORT),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: MICROSERVICE_TOKENS.QUERY_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>(ENV.QUERY_SERVICE_HOST),
            port: configService.get<number>(ENV.QUERY_SERVICE_PORT),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    IdempotencyModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>(ENV.REDIS_HOST)!,
        port: configService.get<number>(ENV.REDIS_PORT)!,
        ttlSeconds: IDEMPOTENCY_TTL_SECONDS,
        keyPrefix: IDEMPOTENCY_KEY_PREFIX,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ApiGatewayController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: IdempotencyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class ApiGatewayModule {}
