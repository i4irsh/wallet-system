import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EventStoreModule,
  EventStoreEntity,
  RabbitMQModule,
  TransferSagaEntity,
  commandServiceConfigSchema,
  ENV,
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
} from '@app/shared';
import { CommandServiceController } from './command-service.controller';
import { CommandHandlers } from './handlers';
import { WalletRepository } from './repositories/wallet.repository';
import { EventPublisherService } from './publishers/event.publisher';
import { TransferSagaRepository } from './sagas/transfer-saga.repository';
import { TransferSagaService } from './sagas/transfer-saga.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: commandServiceConfigSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    CqrsModule,
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>(ENV.DB_WRITE_HOST),
        port: configService.get<number>(ENV.DB_WRITE_PORT),
        username: configService.get<string>(ENV.DB_WRITE_USERNAME),
        password: configService.get<string>(ENV.DB_WRITE_PASSWORD),
        database: configService.get<string>(ENV.DB_WRITE_DATABASE),
        entities: [EventStoreEntity, TransferSagaEntity],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([TransferSagaEntity]),
    EventStoreModule,
    RabbitMQModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>(ENV.RABBITMQ_HOST)!,
        port: configService.get<number>(ENV.RABBITMQ_PORT)!,
        username: configService.get<string>(ENV.RABBITMQ_USER)!,
        password: configService.get<string>(ENV.RABBITMQ_PASSWORD)!,
        exchange: RABBITMQ_EXCHANGES.WALLET_EVENTS,
        queue: RABBITMQ_QUEUES.WALLET_EVENTS,
        deadLetterQueue: RABBITMQ_QUEUES.WALLET_EVENTS_DLQ,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CommandServiceController],
  providers: [...CommandHandlers, WalletRepository, EventPublisherService, TransferSagaRepository, TransferSagaService],
})
export class CommandServiceModule {}
