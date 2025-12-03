import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { TABLE_NAMES } from '../constants';

@Entity(TABLE_NAMES.TRANSACTION_READ_MODEL)
export class TransactionReadEntity {
  @PrimaryColumn()
  id: string;

  @Index()
  @Column({ name: 'wallet_id' })
  walletId: string;

  @Column()
  type: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ name: 'balance_after', type: 'decimal', precision: 18, scale: 2 })
  balanceAfter: number;

  @Column({ name: 'related_wallet_id', nullable: true })
  relatedWalletId: string;

  @Index()
  @Column()
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
