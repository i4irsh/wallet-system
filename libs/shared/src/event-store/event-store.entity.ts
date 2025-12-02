import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('event_store')
@Unique(['aggregateId', 'version'])
export class EventStoreEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'aggregate_id' })
  aggregateId: string;

  @Index()
  @Column({ name: 'aggregate_type' })
  aggregateType: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column({ name: 'event_data', type: 'jsonb' })
  eventData: Record<string, any>;

  @Column()
  version: number;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;
}
