import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletReadEntity, TransactionReadEntity } from '@app/shared';
import { QueryServiceController } from './query-service.controller';
import { WalletProjection } from './projections/wallet.projection';
import { WalletReadRepository } from './repositories/wallet-read.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_READ_HOST || 'localhost',
      port: parseInt(process.env.DB_READ_PORT!, 10) || 5433,
      username: process.env.DB_READ_USERNAME || 'wallet_user',
      password: process.env.DB_READ_PASSWORD || 'wallet_password',
      database: process.env.DB_READ_DATABASE || 'wallet_read_db',
      entities: [WalletReadEntity, TransactionReadEntity],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([WalletReadEntity, TransactionReadEntity]),
  ],
  controllers: [QueryServiceController, WalletProjection],
  providers: [WalletReadRepository],
})
export class QueryServiceModule {}