import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { WalletReadRepository } from '../repositories/wallet-read.repository';

@Controller()
export class WalletProjection {
  constructor(private readonly walletReadRepository: WalletReadRepository) {}

  @EventPattern({ event: 'MoneyDepositedEvent' })
  async handleMoneyDeposited(
    @Payload() data: {
      walletId: string;
      amount: number;
      timestamp: string;
      transactionId: string;
      balanceAfter: number;
    },
  ): Promise<void> {
    console.log('Projection received MoneyDepositedEvent:', data);

    // Update wallet balance
    await this.walletReadRepository.upsertWallet(data.walletId, data.balanceAfter);

    // Add transaction record
    await this.walletReadRepository.addTransaction({
      id: data.transactionId,
      walletId: data.walletId,
      type: 'DEPOSIT',
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      timestamp: new Date(data.timestamp),
    });
  }

  @EventPattern({ event: 'MoneyWithdrawnEvent' })
  async handleMoneyWithdrawn(
    @Payload() data: {
      walletId: string;
      amount: number;
      timestamp: string;
      transactionId: string;
      balanceAfter: number;
    },
  ): Promise<void> {
    console.log('Projection received MoneyWithdrawnEvent:', data);

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

  @EventPattern({ event: 'MoneyTransferredEvent' })
  async handleMoneyTransferred(
    @Payload() data: {
      fromWalletId: string;
      toWalletId: string;
      amount: number;
      timestamp: string;
      transactionId: string;
      fromBalanceAfter: number;
      toBalanceAfter: number;
    },
  ): Promise<void> {
    console.log('Projection received MoneyTransferredEvent:', data);

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
}