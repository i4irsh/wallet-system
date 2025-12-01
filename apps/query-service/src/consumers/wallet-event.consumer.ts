import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '@app/shared';
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
      case 'MoneyDepositedEvent':
        await this.handleMoneyDeposited(message.data);
        break;
      case 'MoneyWithdrawnEvent':
        await this.handleMoneyWithdrawn(message.data);
        break;
      case 'MoneyTransferredEvent':
        await this.handleMoneyTransferred(message.data);
        break;
      // Saga events for read model
      case 'SourceWalletDebitedEvent':
        await this.handleSourceWalletDebited(message.data);
        break;
      case 'DestinationWalletCreditedEvent':
        await this.handleDestinationWalletCredited(message.data);
        break;
      case 'SourceWalletRefundedEvent':
        await this.handleSourceWalletRefunded(message.data);
        break;
      case 'TransferCompletedEvent':
        await this.handleTransferCompleted(message.data);
        break;
      case 'TransferFailedEvent':
        await this.handleTransferFailed(message.data);
        break;
      // Info events (just log)
      case 'TransferInitiatedEvent':
      case 'CompensationInitiatedEvent':
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
    this.logger.debug('Processing MoneyDepositedEvent', data);

    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: 'DEPOSIT',
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
    this.logger.debug('Processing MoneyWithdrawnEvent', data);

    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: 'WITHDRAWAL',
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
    this.logger.debug('Processing MoneyTransferredEvent', data);

    // Update both wallets
    await this.walletReadRepository.upsertWallet(data.fromWalletId, data.fromBalanceAfter);
    await this.walletReadRepository.upsertWallet(data.toWalletId, data.toBalanceAfter);

    // Add transaction records for both wallets
    await this.walletReadRepository.addTransaction({
      id: `${data.transactionId}-out`,
      walletId: data.fromWalletId,
      type: 'TRANSFER_OUT',
      amount: data.amount,
      balanceAfter: data.fromBalanceAfter,
      relatedWalletId: data.toWalletId,
      timestamp: new Date(data.timestamp),
    });

    await this.walletReadRepository.addTransaction({
      id: `${data.transactionId}-in`,
      walletId: data.toWalletId,
      type: 'TRANSFER_IN',
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
      type: 'TRANSFER_OUT',
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
      type: 'TRANSFER_IN',
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
      type: 'REFUND',
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