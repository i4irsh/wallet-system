import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule, getFraudRabbitMQConfig } from '@app/shared';
import { AlertEntity, RiskProfileEntity, RecentEventEntity } from './entities';
import { FraudEventConsumer } from './consumers/fraud-event.consumer';
import { FraudRulesService } from './services/fraud-rules.service';
import { RiskProfileService } from './services/risk-profile.service';
import { FraudRepository } from './repositories/fraud.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_FRAUD_HOST || 'localhost',
      port: parseInt(process.env.DB_FRAUD_PORT!, 10) || 5434,
      username: process.env.DB_FRAUD_USERNAME || 'wallet_user',
      password: process.env.DB_FRAUD_PASSWORD || 'wallet_password',
      database: process.env.DB_FRAUD_DATABASE || 'wallet_fraud_db',
      entities: [AlertEntity, RiskProfileEntity, RecentEventEntity],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([AlertEntity, RiskProfileEntity, RecentEventEntity]),
    RabbitMQModule.forRoot(getFraudRabbitMQConfig()),
  ],
  providers: [FraudEventConsumer, FraudRulesService, RiskProfileService, FraudRepository],
})
export class FraudServiceModule {}
