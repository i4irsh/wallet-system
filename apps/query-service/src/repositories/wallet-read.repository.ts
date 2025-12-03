import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletReadEntity, TransactionReadEntity } from '@app/shared';

@Injectable()
export class WalletReadRepository {
  constructor(
    @InjectRepository(WalletReadEntity)
    private readonly walletRepository: Repository<WalletReadEntity>,
    @InjectRepository(TransactionReadEntity)
    private readonly transactionRepository: Repository<TransactionReadEntity>,
  ) {}

  async findById(walletId: string): Promise<WalletReadEntity | null> {
    return this.walletRepository.findOne({ where: { id: walletId } });
  }

  async upsertWallet(walletId: string, balance: number): Promise<WalletReadEntity> {
    let wallet = await this.findById(walletId);

    if (!wallet) {
      wallet = this.walletRepository.create({
        id: walletId,
        balance,
      });
    } else {
      wallet.balance = balance;
    }

    return this.walletRepository.save(wallet);
  }

  async addTransaction(transaction: {
    id: string;
    walletId: string;
    type: string;
    amount: number;
    balanceAfter: number;
    relatedWalletId?: string;
    timestamp: Date;
  }): Promise<TransactionReadEntity> {
    const entity = this.transactionRepository.create(transaction);
    return this.transactionRepository.save(entity);
  }

  async getTransactions(walletId: string): Promise<TransactionReadEntity[]> {
    return this.transactionRepository.find({
      where: { walletId },
      order: { timestamp: 'DESC' },
    });
  }
}
