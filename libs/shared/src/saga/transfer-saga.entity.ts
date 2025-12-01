import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum TransferSagaStatus {
    INITIATED = 'INITIATED',
    SOURCE_DEBITED = 'SOURCE_DEBITED',
    COMPLETED = 'COMPLETED',
    COMPENSATING = 'COMPENSATING',
    FAILED = 'FAILED',
}

@Entity('transfer_saga')
export class TransferSagaEntity {
    @PrimaryColumn()
    id: string;

    @Index()
    @Column({ name: 'from_wallet_id' })
    fromWalletId: string;

    @Index()
    @Column({ name: 'to_wallet_id' })
    toWalletId: string;

    @Column({ type: 'decimal', precision: 18, scale: 2 })
    amount: number;

    @Index()
    @Column({
        type: 'varchar',
        length: 50,
    })
    status: TransferSagaStatus;

    @Column({ name: 'debit_transaction_id', nullable: true })
    debitTransactionId: string;

    @Column({ name: 'credit_transaction_id', nullable: true })
    creditTransactionId: string;

    @Column({ name: 'compensation_transaction_id', nullable: true })
    compensationTransactionId: string;

    @Column({ name: 'error_message', nullable: true })
    errorMessage: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}