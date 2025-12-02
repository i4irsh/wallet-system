import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('risk_profiles')
export class RiskProfileEntity {
  @PrimaryColumn({ name: 'wallet_id' })
  walletId: string;

  @Column({ name: 'risk_score', type: 'integer', default: 0 })
  riskScore: number;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: RiskLevel,
    default: RiskLevel.LOW,
  })
  riskLevel: RiskLevel;

  @Column({ name: 'alert_count', type: 'integer', default: 0 })
  alertCount: number;

  @UpdateDateColumn({ name: 'last_updated', type: 'timestamptz' })
  lastUpdated: Date;
}
