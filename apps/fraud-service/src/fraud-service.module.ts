import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule, fraudServiceConfigSchema, ENV, RABBITMQ_EXCHANGES, RABBITMQ_QUEUES } from '@app/shared';
import { AlertEntity, RiskProfileEntity, RecentEventEntity } from './entities';
import { FraudEventConsumer } from './consumers/fraud-event.consumer';
import { FraudRulesService } from './services/fraud-rules.service';
import { RiskProfileService } from './services/risk-profile.service';
import { FraudRepository } from './repositories/fraud.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: fraudServiceConfigSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>(ENV.DB_FRAUD_HOST),
        port: configService.get<number>(ENV.DB_FRAUD_PORT),
        username: configService.get<string>(ENV.DB_FRAUD_USERNAME),
        password: configService.get<string>(ENV.DB_FRAUD_PASSWORD),
        database: configService.get<string>(ENV.DB_FRAUD_DATABASE),
        entities: [AlertEntity, RiskProfileEntity, RecentEventEntity],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([AlertEntity, RiskProfileEntity, RecentEventEntity]),
    RabbitMQModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>(ENV.RABBITMQ_HOST)!,
        port: configService.get<number>(ENV.RABBITMQ_PORT)!,
        username: configService.get<string>(ENV.RABBITMQ_USER)!,
        password: configService.get<string>(ENV.RABBITMQ_PASSWORD)!,
        exchange: RABBITMQ_EXCHANGES.WALLET_EVENTS,
        queue: RABBITMQ_QUEUES.FRAUD_EVENTS,
        deadLetterQueue: RABBITMQ_QUEUES.FRAUD_EVENTS_DLQ,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [FraudEventConsumer, FraudRulesService, RiskProfileService, FraudRepository],
})
export class FraudServiceModule {}
