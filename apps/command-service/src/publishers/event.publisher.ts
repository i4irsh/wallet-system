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

  // Saga events
  async publishTransferInitiated(data: {
    sagaId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    timestamp: Date;
  }): Promise<void> {
    await this.rabbitMQService.publish('wallet.transfer.initiated', {
      eventType: 'TransferInitiatedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published TransferInitiatedEvent for saga ${data.sagaId}`);
  }

  async publishSourceWalletDebited(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: Date;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish('wallet.transfer.source.debited', {
      eventType: 'SourceWalletDebitedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published SourceWalletDebitedEvent for saga ${data.sagaId}`);
  }

  async publishDestinationWalletCredited(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: Date;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish('wallet.transfer.destination.credited', {
      eventType: 'DestinationWalletCreditedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published DestinationWalletCreditedEvent for saga ${data.sagaId}`);
  }

  async publishTransferCompleted(data: {
    sagaId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    timestamp: Date;
    fromBalanceAfter: number;
    toBalanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish('wallet.transfer.completed', {
      eventType: 'TransferCompletedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published TransferCompletedEvent for saga ${data.sagaId}`);
  }

  async publishTransferFailed(data: {
    sagaId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    reason: string;
    timestamp: Date;
  }): Promise<void> {
    await this.rabbitMQService.publish('wallet.transfer.failed', {
      eventType: 'TransferFailedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published TransferFailedEvent for saga ${data.sagaId}`);
  }

  async publishCompensationInitiated(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    reason: string;
    timestamp: Date;
  }): Promise<void> {
    await this.rabbitMQService.publish('wallet.transfer.compensation.initiated', {
      eventType: 'CompensationInitiatedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published CompensationInitiatedEvent for saga ${data.sagaId}`);
  }

  async publishSourceWalletRefunded(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: Date;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish('wallet.transfer.source.refunded', {
      eventType: 'SourceWalletRefundedEvent',
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published SourceWalletRefundedEvent for saga ${data.sagaId}`);
  }

  // Keep backward compatibility - this combines the transfer into one event for read model
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
