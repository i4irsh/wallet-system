import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService, EVENT_TYPES, TRANSACTION_TYPES } from '@app/shared';
import { WalletReadRepository } from '../repositories/wallet-read.repository';

@Injectable()
export class WalletEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(WalletEventConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly walletReadRepository: WalletReadRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.startConsuming();
  }

  private async startConsuming(): Promise<void> {
    await this.rabbitMQService.consume(async (message, ack, nack) => {
      this.logger.log(`Received event: ${message.eventType}`);

      try {
        await this.handleEvent(message);
        ack();
        this.logger.log(`Successfully processed ${message.eventType}`);
      } catch (error) {
        this.logger.error(`Error processing ${message.eventType}`, error);
        // Send to DLQ (don't requeue)
        nack(false);
      }
    });
  }

  private async handleEvent(message: { eventType: string; data: any }): Promise<void> {
    switch (message.eventType) {
      case EVENT_TYPES.MONEY_DEPOSITED:
        await this.handleMoneyDeposited(message.data);
        break;
      case EVENT_TYPES.MONEY_WITHDRAWN:
        await this.handleMoneyWithdrawn(message.data);
        break;
      case EVENT_TYPES.MONEY_TRANSFERRED:
        await this.handleMoneyTransferred(message.data);
        break;
      // Saga events for read model
      case EVENT_TYPES.SOURCE_WALLET_DEBITED:
        await this.handleSourceWalletDebited(message.data);
        break;
      case EVENT_TYPES.DESTINATION_WALLET_CREDITED:
        await this.handleDestinationWalletCredited(message.data);
        break;
      case EVENT_TYPES.SOURCE_WALLET_REFUNDED:
        await this.handleSourceWalletRefunded(message.data);
        break;
      case EVENT_TYPES.TRANSFER_COMPLETED:
        await this.handleTransferCompleted(message.data);
        break;
      case EVENT_TYPES.TRANSFER_FAILED:
        await this.handleTransferFailed(message.data);
        break;
      // Info events (just log)
      case EVENT_TYPES.TRANSFER_INITIATED:
      case EVENT_TYPES.COMPENSATION_INITIATED:
        this.logger.log(`Info event: ${message.eventType}`, message.data);
        break;
      default:
        this.logger.warn(`Unknown event type: ${message.eventType}`);
    }
  }

  private async handleMoneyDeposited(data: {
    walletId: string;
    amount: number;
    timestamp: string;
    transactionId: string;
    balanceAfter: number;
  }): Promise<void> {
    this.logger.debug(`Processing ${EVENT_TYPES.MONEY_DEPOSITED}`, data);

    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: TRANSACTION_TYPES.DEPOSIT,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      timestamp: new Date(data.timestamp),
    });
  }

  private async handleMoneyWithdrawn(data: {
    walletId: string;
    amount: number;
    timestamp: string;
    transactionId: string;
    balanceAfter: number;
  }): Promise<void> {
    this.logger.debug(`Processing ${EVENT_TYPES.MONEY_WITHDRAWN}`, data);

    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: TRANSACTION_TYPES.WITHDRAWAL,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      timestamp: new Date(data.timestamp),
    });
  }

  private async handleMoneyTransferred(data: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    timestamp: string;
    transactionId: string;
    fromBalanceAfter: number;
    toBalanceAfter: number;
  }): Promise<void> {
    this.logger.debug(`Processing ${EVENT_TYPES.MONEY_TRANSFERRED}`, data);

    // Update both wallets
    await this.walletReadRepository.upsertWallet(data.fromWalletId, data.fromBalanceAfter);
    await this.walletReadRepository.upsertWallet(data.toWalletId, data.toBalanceAfter);

    // Add transaction records for both wallets
    await this.walletReadRepository.addTransaction({
      id: `${data.transactionId}-out`,
      walletId: data.fromWalletId,
      type: TRANSACTION_TYPES.TRANSFER_OUT,
      amount: data.amount,
      balanceAfter: data.fromBalanceAfter,
      relatedWalletId: data.toWalletId,
      timestamp: new Date(data.timestamp),
    });

    await this.walletReadRepository.addTransaction({
      id: `${data.transactionId}-in`,
      walletId: data.toWalletId,
      type: TRANSACTION_TYPES.TRANSFER_IN,
      amount: data.amount,
      balanceAfter: data.toBalanceAfter,
      relatedWalletId: data.fromWalletId,
      timestamp: new Date(data.timestamp),
    });
  }

  // Saga event handlers
  private async handleSourceWalletDebited(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: string;
    balanceAfter: number;
  }): Promise<void> {
    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: TRANSACTION_TYPES.TRANSFER_OUT,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      timestamp: new Date(data.timestamp),
    });
  }

  private async handleDestinationWalletCredited(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: string;
    balanceAfter: number;
  }): Promise<void> {
    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: TRANSACTION_TYPES.TRANSFER_IN,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      timestamp: new Date(data.timestamp),
    });
  }

  private async handleSourceWalletRefunded(data: {
    sagaId: string;
    walletId: string;
    amount: number;
    transactionId: string;
    timestamp: string;
    balanceAfter: number;
  }): Promise<void> {
    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: TRANSACTION_TYPES.REFUND,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      timestamp: new Date(data.timestamp),
    });
  }

  private async handleTransferCompleted(data: {
    sagaId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`Transfer ${data.sagaId} completed: ${data.fromWalletId} -> ${data.toWalletId}`);
  }

  private async handleTransferFailed(data: {
    sagaId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    reason: string;
    timestamp: string;
  }): Promise<void> {
    this.logger.warn(`Transfer ${data.sagaId} failed: ${data.reason}`);
  }
}
