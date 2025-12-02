export class MoneyDepositedEvent {
  constructor(
    public readonly walletId: string,
    public readonly amount: number,
    public readonly timestamp: Date,
    public readonly transactionId: string,
  ) {}
}

export class MoneyWithdrawnEvent {
  constructor(
    public readonly walletId: string,
    public readonly amount: number,
    public readonly timestamp: Date,
    public readonly transactionId: string,
  ) {}
}

export class MoneyTransferredEvent {
  constructor(
    public readonly fromWalletId: string,
    public readonly toWalletId: string,
    public readonly amount: number,
    public readonly timestamp: Date,
    public readonly transactionId: string,
  ) {}
}

// Saga events
export class TransferInitiatedEvent {
  constructor(
    public readonly sagaId: string,
    public readonly fromWalletId: string,
    public readonly toWalletId: string,
    public readonly amount: number,
    public readonly timestamp: Date,
  ) {}
}

export class SourceWalletDebitedEvent {
  constructor(
    public readonly sagaId: string,
    public readonly walletId: string,
    public readonly amount: number,
    public readonly transactionId: string,
    public readonly timestamp: Date,
  ) {}
}

export class DestinationWalletCreditedEvent {
  constructor(
    public readonly sagaId: string,
    public readonly walletId: string,
    public readonly amount: number,
    public readonly transactionId: string,
    public readonly timestamp: Date,
  ) {}
}

export class TransferCompletedEvent {
  constructor(
    public readonly sagaId: string,
    public readonly fromWalletId: string,
    public readonly toWalletId: string,
    public readonly amount: number,
    public readonly timestamp: Date,
  ) {}
}

export class TransferFailedEvent {
  constructor(
    public readonly sagaId: string,
    public readonly fromWalletId: string,
    public readonly toWalletId: string,
    public readonly amount: number,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {}
}

export class CompensationInitiatedEvent {
  constructor(
    public readonly sagaId: string,
    public readonly walletId: string,
    public readonly amount: number,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {}
}

export class SourceWalletRefundedEvent {
  constructor(
    public readonly sagaId: string,
    public readonly walletId: string,
    public readonly amount: number,
    public readonly transactionId: string,
    public readonly timestamp: Date,
  ) {}
}
