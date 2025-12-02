import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '@app/shared';
import { FraudRulesService } from '../services/fraud-rules.service';
import { RiskProfileService } from '../services/risk-profile.service';
import { FraudRepository } from '../repositories/fraud.repository';
import { AlertSeverity } from '../entities';

interface WalletEvent {
  eventType: string;
  data: {
    walletId?: string;
    fromWalletId?: string;
    toWalletId?: string;
    amount?: number;
    transactionId?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

@Injectable()
export class FraudEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(FraudEventConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly fraudRulesService: FraudRulesService,
    private readonly riskProfileService: RiskProfileService,
    private readonly fraudRepository: FraudRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.startConsuming();
  }

  private async startConsuming(): Promise<void> {
    await this.rabbitMQService.consume(async (message: WalletEvent, ack, nack) => {
      this.logger.log(`Received event for fraud analysis: ${message.eventType}`);

      try {
        await this.processEvent(message);
        ack();
        this.logger.log(`Successfully processed ${message.eventType} for fraud detection`);
      } catch (error) {
        this.logger.error(`Error processing ${message.eventType} for fraud detection`, error);
        nack(false);
      }
    });
  }

  private async processEvent(message: WalletEvent): Promise<void> {
    const { eventType, data } = message;

    // Skip non-transactional events
    const transactionalEvents = [
      'MoneyDepositedEvent',
      'MoneyWithdrawnEvent',
      'MoneyTransferredEvent',
      'SourceWalletDebitedEvent',
      'DestinationWalletCreditedEvent',
    ];

    if (!transactionalEvents.includes(eventType)) {
      this.logger.debug(`Skipping non-transactional event: ${eventType}`);
      return;
    }

    // Get wallet IDs to analyze
    const walletIds = this.extractWalletIds(eventType, data);

    for (const walletId of walletIds) {
      // Track this event for velocity and pattern checks
      await this.fraudRepository.trackEvent({
        walletId,
        eventType,
        amount: data.amount,
        transactionId: data.transactionId,
      });

      // Evaluate fraud rules
      const alerts = await this.fraudRulesService.evaluateRules({
        walletId,
        eventType,
        amount: data.amount || 0,
        transactionId: data.transactionId,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        eventData: data,
      });

      // Process any triggered alerts
      for (const alert of alerts) {
        this.logger.warn(
          `Fraud alert triggered: ${alert.ruleName} for wallet ${walletId}`,
          { severity: alert.severity, ruleId: alert.ruleId },
        );

        // Save alert to database
        await this.fraudRepository.createAlert({
          walletId,
          ruleId: alert.ruleId,
          ruleName: alert.ruleName,
          severity: alert.severity as AlertSeverity,
          transactionId: data.transactionId || null,
          eventType,
          eventData: data,
        });

        // Update risk profile
        await this.riskProfileService.updateRiskProfile(
          walletId,
          alert.severity as AlertSeverity,
        );
      }
    }
  }

  private extractWalletIds(eventType: string, data: Record<string, any>): string[] {
    const walletIds: string[] = [];

    if (data.walletId) {
      walletIds.push(data.walletId);
    }
    if (data.fromWalletId) {
      walletIds.push(data.fromWalletId);
    }
    if (data.toWalletId) {
      walletIds.push(data.toWalletId);
    }

    return [...new Set(walletIds)]; // Remove duplicates
  }
}

