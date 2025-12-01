import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventStoreModule, EventStoreEntity } from '@app/shared';
import { CommandServiceController } from './command-service.controller';
import { CommandHandlers } from './handlers';
import { WalletRepository } from './repositories/wallet.repository';
import { EventPublisherService } from './publishers/event.publisher';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT!, 10) || 5432,
      username: process.env.DB_USERNAME || 'wallet_user',
      password: process.env.DB_PASSWORD || 'wallet_password',
      database: process.env.DB_DATABASE || 'wallet_db',
      entities: [EventStoreEntity],
      synchronize: false,
    }),
    EventStoreModule,
  ],
  controllers: [CommandServiceController],
  providers: [...CommandHandlers, WalletRepository, EventPublisherService],
})
export class CommandServiceModule {}