import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('alerts')
export class AlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @Column({ name: 'rule_id' })
  ruleId: string;

  @Column({ name: 'rule_name' })
  ruleName: string;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
  })
  severity: AlertSeverity;

  @Column({ name: 'transaction_id', type: 'varchar', nullable: true })
  transactionId: string | null;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column({ name: 'event_data', type: 'jsonb' })
  eventData: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
