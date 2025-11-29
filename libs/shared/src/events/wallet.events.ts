export class MoneyDepositedEvent {
    constructor(
        public readonly walletId: string,
        public readonly amount: number,
        public readonly timestamp: Date,
        public readonly transactionId: string,
    ) { }
}

export class MoneyWithdrawnEvent {
    constructor(
        public readonly walletId: string,
        public readonly amount: number,
        public readonly timestamp: Date,
        public readonly transactionId: string,
    ) { }
}

export class MoneyTransferredEvent {
    constructor(
        public readonly fromWalletId: string,
        public readonly toWalletId: string,
        public readonly amount: number,
        public readonly timestamp: Date,
        public readonly transactionId: string,
    ) { }
}