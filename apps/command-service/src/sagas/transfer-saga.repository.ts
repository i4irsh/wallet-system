import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransferSagaEntity, TransferSagaStatus } from '@app/shared';

@Injectable()
export class TransferSagaRepository {
    constructor(
        @InjectRepository(TransferSagaEntity)
        private readonly repository: Repository<TransferSagaEntity>,
    ) { }

    async create(data: {
        id: string;
        fromWalletId: string;
        toWalletId: string;
        amount: number;
    }): Promise<TransferSagaEntity> {
        const saga = this.repository.create({
            ...data,
            status: TransferSagaStatus.INITIATED,
        });
        return this.repository.save(saga);
    }

    async findById(id: string): Promise<TransferSagaEntity | null> {
        return this.repository.findOne({ where: { id } });
    }

    async updateStatus(
        id: string,
        status: TransferSagaStatus,
        additionalData?: Partial<TransferSagaEntity>,
    ): Promise<void> {
        await this.repository.update(id, {
            status,
            ...additionalData,
            updatedAt: new Date(),
        });
    }

    async setSourceDebited(id: string, debitTransactionId: string): Promise<void> {
        await this.updateStatus(id, TransferSagaStatus.SOURCE_DEBITED, {
            debitTransactionId,
        });
    }

    async setCompleted(id: string, creditTransactionId: string): Promise<void> {
        await this.updateStatus(id, TransferSagaStatus.COMPLETED, {
            creditTransactionId,
        });
    }

    async setCompensating(id: string, errorMessage: string): Promise<void> {
        await this.updateStatus(id, TransferSagaStatus.COMPENSATING, {
            errorMessage,
        });
    }

    async setFailed(id: string, compensationTransactionId: string): Promise<void> {
        await this.updateStatus(id, TransferSagaStatus.FAILED, {
            compensationTransactionId,
        });
    }
}