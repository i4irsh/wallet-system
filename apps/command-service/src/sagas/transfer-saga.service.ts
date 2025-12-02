import { Injectable, Logger } from '@nestjs/common';
import { randomUUID as uuid } from 'crypto';
import { TransferSagaStatus, MoneyWithdrawnEvent, MoneyDepositedEvent } from '@app/shared';
import { WalletRepository } from '../repositories/wallet.repository';
import { TransferSagaRepository } from './transfer-saga.repository';
import { EventPublisherService } from '../publishers/event.publisher';

export interface TransferResult {
  success: boolean;
  sagaId: string;
  message: string;
  fromBalance?: number;
  toBalance?: number;
  error?: string;
}

@Injectable()
export class TransferSagaService {
  private readonly logger = new Logger(TransferSagaService.name);

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly sagaRepository: TransferSagaRepository,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(fromWalletId: string, toWalletId: string, amount: number): Promise<TransferResult> {
    const sagaId = uuid();

    this.logger.log(`Starting transfer saga ${sagaId}: ${fromWalletId} -> ${toWalletId}, amount: ${amount}`);

    // Step 1: Initialize saga
    await this.sagaRepository.create({
      id: sagaId,
      fromWalletId,
      toWalletId,
      amount,
    });

    // Publish TransferInitiated event
    await this.eventPublisher.publishTransferInitiated({
      sagaId,
      fromWalletId,
      toWalletId,
      amount,
      timestamp: new Date(),
    });

    let debitTransactionId: string;
    let fromBalance: number;

    // Step 2: Debit source wallet
    try {
      const result = await this.debitSourceWallet(sagaId, fromWalletId, amount);
      debitTransactionId = result.transactionId;
      fromBalance = result.balance;

      await this.sagaRepository.setSourceDebited(sagaId, debitTransactionId);

      this.logger.log(`Saga ${sagaId}: Source wallet debited successfully`);
    } catch (error) {
      this.logger.error(`Saga ${sagaId}: Failed to debit source wallet`, error);

      await this.sagaRepository.updateStatus(sagaId, TransferSagaStatus.FAILED, {
        errorMessage: error.message,
      });

      await this.eventPublisher.publishTransferFailed({
        sagaId,
        fromWalletId,
        toWalletId,
        amount,
        reason: error.message,
        timestamp: new Date(),
      });

      return {
        success: false,
        sagaId,
        message: 'Transfer failed: Unable to debit source wallet',
        error: error.message,
      };
    }

    // Step 3: Credit destination wallet
    try {
      const result = await this.creditDestinationWallet(sagaId, toWalletId, amount);

      await this.sagaRepository.setCompleted(sagaId, result.transactionId);

      this.logger.log(`Saga ${sagaId}: Transfer completed successfully`);

      await this.eventPublisher.publishTransferCompleted({
        sagaId,
        fromWalletId,
        toWalletId,
        amount,
        timestamp: new Date(),
        fromBalanceAfter: fromBalance,
        toBalanceAfter: result.balance,
      });

      return {
        success: true,
        sagaId,
        message: `Transferred ${amount} from wallet ${fromWalletId} to wallet ${toWalletId}`,
        fromBalance,
        toBalance: result.balance,
      };
    } catch (error) {
      this.logger.error(`Saga ${sagaId}: Failed to credit destination wallet, initiating compensation`, error);

      // Step 4: Compensate - refund source wallet
      await this.sagaRepository.setCompensating(sagaId, error.message);

      await this.eventPublisher.publishCompensationInitiated({
        sagaId,
        walletId: fromWalletId,
        amount,
        reason: error.message,
        timestamp: new Date(),
      });

      try {
        const compensationResult = await this.compensateSourceWallet(sagaId, fromWalletId, amount);

        await this.sagaRepository.setFailed(sagaId, compensationResult.transactionId);

        this.logger.log(`Saga ${sagaId}: Compensation completed, transfer failed`);

        await this.eventPublisher.publishTransferFailed({
          sagaId,
          fromWalletId,
          toWalletId,
          amount,
          reason: `Credit failed: ${error.message}. Funds refunded.`,
          timestamp: new Date(),
        });

        return {
          success: false,
          sagaId,
          message: 'Transfer failed: Unable to credit destination wallet. Funds refunded.',
          fromBalance: compensationResult.balance,
          error: error.message,
        };
      } catch (compensationError) {
        // Critical: Compensation failed - needs manual intervention
        this.logger.error(`Saga ${sagaId}: CRITICAL - Compensation failed!`, compensationError);

        await this.sagaRepository.updateStatus(sagaId, TransferSagaStatus.COMPENSATING, {
          errorMessage: `Compensation failed: ${compensationError.message}`,
        });

        return {
          success: false,
          sagaId,
          message: 'CRITICAL: Transfer failed and compensation failed. Manual intervention required.',
          error: `Original error: ${error.message}. Compensation error: ${compensationError.message}`,
        };
      }
    }
  }

  private async debitSourceWallet(
    sagaId: string,
    walletId: string,
    amount: number,
  ): Promise<{ transactionId: string; balance: number }> {
    const wallet = await this.walletRepository.findById(walletId);

    wallet.withdraw(amount);

    const events = wallet.getUncommittedEvents();
    const lastEvent = events[events.length - 1] as MoneyWithdrawnEvent;

    await this.walletRepository.save(wallet);

    await this.eventPublisher.publishSourceWalletDebited({
      sagaId,
      walletId,
      amount,
      transactionId: lastEvent.transactionId,
      timestamp: lastEvent.timestamp,
      balanceAfter: wallet.getBalance(),
    });

    return {
      transactionId: lastEvent.transactionId,
      balance: wallet.getBalance(),
    };
  }

  private async creditDestinationWallet(
    sagaId: string,
    walletId: string,
    amount: number,
  ): Promise<{ transactionId: string; balance: number }> {
    const wallet = await this.walletRepository.findById(walletId);

    wallet.deposit(amount);

    const events = wallet.getUncommittedEvents();
    const lastEvent = events[events.length - 1] as MoneyDepositedEvent;

    await this.walletRepository.save(wallet);

    await this.eventPublisher.publishDestinationWalletCredited({
      sagaId,
      walletId,
      amount,
      transactionId: lastEvent.transactionId,
      timestamp: lastEvent.timestamp,
      balanceAfter: wallet.getBalance(),
    });

    return {
      transactionId: lastEvent.transactionId,
      balance: wallet.getBalance(),
    };
  }

  private async compensateSourceWallet(
    sagaId: string,
    walletId: string,
    amount: number,
  ): Promise<{ transactionId: string; balance: number }> {
    const wallet = await this.walletRepository.findById(walletId);

    // Deposit back the amount (refund)
    wallet.deposit(amount);

    const events = wallet.getUncommittedEvents();
    const lastEvent = events[events.length - 1] as MoneyDepositedEvent;

    await this.walletRepository.save(wallet);

    await this.eventPublisher.publishSourceWalletRefunded({
      sagaId,
      walletId,
      amount,
      transactionId: lastEvent.transactionId,
      timestamp: lastEvent.timestamp,
      balanceAfter: wallet.getBalance(),
    });

    return {
      transactionId: lastEvent.transactionId,
      balance: wallet.getBalance(),
    };
  }
}
