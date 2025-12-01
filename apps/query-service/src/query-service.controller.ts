import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WalletReadRepository } from './repositories/wallet-read.repository';

@Controller()
export class QueryServiceController {
  constructor(private readonly walletReadRepository: WalletReadRepository) {}

  @MessagePattern({ cmd: 'ping' })
  ping(): string {
    return 'pong from query-service';
  }

  @MessagePattern({ cmd: 'get_balance' })
  async getBalance(@Payload() data: { walletId: string }) {
    const wallet = await this.walletReadRepository.findById(data.walletId);

    if (!wallet) {
      return {
        id: data.walletId,
        balance: 0,
        message: 'Wallet not found',
      };
    }

    return {
      id: wallet.id,
      balance: Number(wallet.balance),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  @MessagePattern({ cmd: 'get_transactions' })
  async getTransactions(@Payload() data: { walletId: string }) {
    const transactions = await this.walletReadRepository.getTransactions(data.walletId);

    return transactions.map((t) => ({
      id: t.id,
      walletId: t.walletId,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      relatedWalletId: t.relatedWalletId,
      timestamp: t.timestamp,
    }));
  }
}