import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQService, RABBITMQ_ROUTING_KEYS, EVENT_TYPES } from '@app/shared';

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
      eventType: EVENT_TYPES.MONEY_DEPOSITED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.MONEY_DEPOSITED} for wallet ${data.walletId}`);
  }

  async publishMoneyWithdrawn(data: {
    walletId: string;
    amount: number;
    timestamp: Date;
    transactionId: string;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.MONEY_WITHDRAWN, {
      eventType: EVENT_TYPES.MONEY_WITHDRAWN,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.MONEY_WITHDRAWN} for wallet ${data.walletId}`);
  }

  // Saga events
  async publishTransferInitiated(data: {
    sagaId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    timestamp: Date;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.TRANSFER_INITIATED, {
      eventType: EVENT_TYPES.TRANSFER_INITIATED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.TRANSFER_INITIATED} for saga ${data.sagaId}`);
  }

  async publishSourceWalletDebited(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: Date;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.SOURCE_DEBITED, {
      eventType: EVENT_TYPES.SOURCE_WALLET_DEBITED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.SOURCE_WALLET_DEBITED} for saga ${data.sagaId}`);
  }

  async publishDestinationWalletCredited(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: Date;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.DESTINATION_CREDITED, {
      eventType: EVENT_TYPES.DESTINATION_WALLET_CREDITED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.DESTINATION_WALLET_CREDITED} for saga ${data.sagaId}`);
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
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.TRANSFER_COMPLETED, {
      eventType: EVENT_TYPES.TRANSFER_COMPLETED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.TRANSFER_COMPLETED} for saga ${data.sagaId}`);
  }

  async publishTransferFailed(data: {
    sagaId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    reason: string;
    timestamp: Date;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.TRANSFER_FAILED, {
      eventType: EVENT_TYPES.TRANSFER_FAILED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.TRANSFER_FAILED} for saga ${data.sagaId}`);
  }

  async publishCompensationInitiated(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    reason: string;
    timestamp: Date;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.COMPENSATION_INITIATED, {
      eventType: EVENT_TYPES.COMPENSATION_INITIATED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.COMPENSATION_INITIATED} for saga ${data.sagaId}`);
  }

  async publishSourceWalletRefunded(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: Date;
    balanceAfter: number;
  }): Promise<void> {
    await this.rabbitMQService.publish(RABBITMQ_ROUTING_KEYS.SOURCE_REFUNDED, {
      eventType: EVENT_TYPES.SOURCE_WALLET_REFUNDED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.SOURCE_WALLET_REFUNDED} for saga ${data.sagaId}`);
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
      eventType: EVENT_TYPES.MONEY_TRANSFERRED,
      data,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published ${EVENT_TYPES.MONEY_TRANSFERRED} from ${data.fromWalletId} to ${data.toWalletId}`);
  }
}
