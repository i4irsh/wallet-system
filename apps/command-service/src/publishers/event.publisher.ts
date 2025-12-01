import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class EventPublisherService implements OnModuleInit {
    private queryServiceClient: ClientProxy;

    onModuleInit() {
        this.queryServiceClient = ClientProxyFactory.create({
            transport: Transport.TCP,
            options: {
                host: 'localhost',
                port: 3002,
            },
        });
    }

    async publishEvent(eventType: string, eventData: any): Promise<void> {
        try {
            await this.queryServiceClient
                .emit({ event: eventType }, eventData)
                .toPromise();
            console.log(`Published event: ${eventType}`, eventData);
        } catch (error) {
            console.error(`Failed to publish event: ${eventType}`, error);
        }
    }

    async publishMoneyDeposited(data: {
        walletId: string;
        amount: number;
        timestamp: Date;
        transactionId: string;
        balanceAfter: number;
    }): Promise<void> {
        await this.publishEvent('MoneyDepositedEvent', data);
    }

    async publishMoneyWithdrawn(data: {
        walletId: string;
        amount: number;
        timestamp: Date;
        transactionId: string;
        balanceAfter: number;
    }): Promise<void> {
        await this.publishEvent('MoneyWithdrawnEvent', data);
    }

    async publishMoneyTransferred(data: {
        fromWalletId: string;
        toWalletId: string;
        amount: number;
        timestamp: Date;
        transactionId: string;
        fromBalanceAfter: number;
        toBalanceAfter: number;
    }): Promise<void> {
        await this.publishEvent('MoneyTransferredEvent', data);
    }
}