import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQService, RABBITMQ_ROUTING_KEYS } from '@app/shared';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async publishMoneyDeposited(data: {
    walletId: string;
    amount: number;
    timestamp: Date;
    transactionId: string;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.MONEY_DEPOSITED, {
      eventType: 'MoneyDepositedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published MoneyDepositedEvent for wallet ${data.walletId}`);
  }

  async publishMoneyWithdrawn(data: {
    walletId: string;
    amount: number;
    timestamp: Date;
    transactionId: string;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.MONEY_WITHDRAWN, {
      eventType: 'MoneyWithdrawnEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published MoneyWithdrawnEvent for wallet ${data.walletId}`);
  }

  async publishMoneyTransferred(data: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    timestamp: Date;
    transactionId: string;
    fromBalanceAfter: number;
    toBalanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.MONEY_TRANSFERRED, {
      eventType: 'MoneyTransferredEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published MoneyTransferredEvent from ${data.fromWalletId} to ${data.toWalletId}`);
  }
}