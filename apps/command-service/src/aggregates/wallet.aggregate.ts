import { AggregateRoot } from '@nestjs/cqrs';
import {
  MoneyDepositedEvent,
  MoneyWithdrawnEvent,
  MoneyTransferredEvent,
} from '@app/shared';
import { randomUUID as uuid } from 'crypto';

export class WalletAggregate extends AggregateRoot {
  private id: string;
  private balance: number = 0;
  private version: number = 0;

  constructor(id: string) {
    super();
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  getBalance(): number {
    return this.balance;
  }

  getVersion(): number {
    return this.version;
  }

  setVersion(version: number): void {
    this.version = version;
  }

  // Command methods - these create and apply new events
  deposit(amount: number): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const event = new MoneyDepositedEvent(this.id, amount, new Date(), uuid());

    this.applyMoneyDeposited(event);
    this.apply(event);
    this.version++;
  }

  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error(
        `Insufficient funds. Current balance: ${this.balance}, requested: ${amount}`,
      );
    }

    const event = new MoneyWithdrawnEvent(this.id, amount, new Date(), uuid());

    this.applyMoneyWithdrawn(event);
    this.apply(event);
    this.version++;
  }

  transferOut(toWalletId: string, amount: number): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (this.balance < amount) {
      throw new Error(
        `Insufficient funds. Current balance: ${this.balance}, requested: ${amount}`,
      );
    }

    const event = new MoneyTransferredEvent(
      this.id,
      toWalletId,
      amount,
      new Date(),
      uuid(),
    );

    this.applyMoneyTransferred(event);
    this.apply(event);
    this.version++;
  }

  // Replay method - used when loading aggregate from event store
  replayEvent(event: any): void {
    if (event instanceof MoneyDepositedEvent) {
      this.applyMoneyDeposited(event);
    } else if (event instanceof MoneyWithdrawnEvent) {
      this.applyMoneyWithdrawn(event);
    } else if (event instanceof MoneyTransferredEvent) {
      this.applyMoneyTransferred(event);
    }
  }

  // Event appliers - these mutate the state
  private applyMoneyDeposited(event: MoneyDepositedEvent): void {
    this.balance += event.amount;
  }

  private applyMoneyWithdrawn(event: MoneyWithdrawnEvent): void {
    this.balance -= event.amount;
  }

  private applyMoneyTransferred(event: MoneyTransferredEvent): void {
    if (event.fromWalletId === this.id) {
      this.balance -= event.amount;
    } else if (event.toWalletId === this.id) {
      this.balance += event.amount;
    }
  }
}
