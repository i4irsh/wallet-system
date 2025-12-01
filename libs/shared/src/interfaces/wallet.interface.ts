export interface IWallet {
  id: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}