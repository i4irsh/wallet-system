import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletReadEntity, TransactionReadEntity, RabbitMQModule, queryServiceConfigSchema, ENV } from '@app/shared';
import { QueryServiceController } from './query-service.controller';
import { WalletReadRepository } from './repositories/wallet-read.repository';
import { WalletEventConsumer } from './consumers/wallet-event.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: queryServiceConfigSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>(ENV.DB_READ_HOST),
        port: configService.get<number>(ENV.DB_READ_PORT),
        username: configService.get<string>(ENV.DB_READ_USERNAME),
        password: configService.get<string>(ENV.DB_READ_PASSWORD),
        database: configService.get<string>(ENV.DB_READ_DATABASE),
        entities: [WalletReadEntity, TransactionReadEntity],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([WalletReadEntity, TransactionReadEntity]),
    RabbitMQModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>(ENV.RABBITMQ_HOST)!,
        port: configService.get<number>(ENV.RABBITMQ_PORT)!,
        username: configService.get<string>(ENV.RABBITMQ_USER)!,
        password: configService.get<string>(ENV.RABBITMQ_PASSWORD)!,
        exchange: 'wallet.events',
        queue: 'wallet.events.queue',
        deadLetterQueue: 'wallet.events.dlq',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [QueryServiceController],
  providers: [WalletReadRepository, WalletEventConsumer],
})
export class QueryServiceModule {}
