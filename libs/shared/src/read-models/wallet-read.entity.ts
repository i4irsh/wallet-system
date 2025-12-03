import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TABLE_NAMES } from '../constants';

@Entity(TABLE_NAMES.WALLET_READ_MODEL)
export class WalletReadEntity {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
