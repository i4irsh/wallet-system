// Event type constants - single source of truth for event type strings
export const EVENT_TYPES = {
  // Basic wallet events
  MONEY_DEPOSITED: 'MoneyDepositedEvent',
  MONEY_WITHDRAWN: 'MoneyWithdrawnEvent',
  MONEY_TRANSFERRED: 'MoneyTransferredEvent',

  // Saga events
  TRANSFER_INITIATED: 'TransferInitiatedEvent',
  SOURCE_WALLET_DEBITED: 'SourceWalletDebitedEvent',
  DESTINATION_WALLET_CREDITED: 'DestinationWalletCreditedEvent',
  TRANSFER_COMPLETED: 'TransferCompletedEvent',
  TRANSFER_FAILED: 'TransferFailedEvent',
  COMPENSATION_INITIATED: 'CompensationInitiatedEvent',
  SOURCE_WALLET_REFUNDED: 'SourceWalletRefundedEvent',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Transaction type constants for read models
export const TRANSACTION_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  REFUND: 'REFUND',
} as const;

export type TransactionTypeValue = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

// Microservice injection token constants
export const MICROSERVICE_TOKENS = {
  COMMAND_SERVICE: 'COMMAND_SERVICE',
  QUERY_SERVICE: 'QUERY_SERVICE',
} as const;

export type MicroserviceToken = (typeof MICROSERVICE_TOKENS)[keyof typeof MICROSERVICE_TOKENS];

// TCP message pattern constants for microservice communication
export const MESSAGE_PATTERNS = {
  PING: 'ping',
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  TRANSFER: 'transfer',
  GET_BALANCE: 'get_balance',
  GET_TRANSACTIONS: 'get_transactions',
} as const;

export type MessagePattern = (typeof MESSAGE_PATTERNS)[keyof typeof MESSAGE_PATTERNS];

// Aggregate type constants
export const AGGREGATE_TYPES = {
  WALLET: 'WalletAggregate',
} as const;

export type AggregateType = (typeof AGGREGATE_TYPES)[keyof typeof AGGREGATE_TYPES];

// Database table name constants
export const TABLE_NAMES = {
  EVENT_STORE: 'event_store',
  TRANSFER_SAGA: 'transfer_saga',
  WALLET_READ_MODEL: 'wallet_read_model',
  TRANSACTION_READ_MODEL: 'transaction_read_model',
  ALERTS: 'alerts',
  RISK_PROFILES: 'risk_profiles',
  RECENT_EVENTS: 'recent_events',
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];

// Fraud rule constants
export const FRAUD_RULES = {
  LARGE_TRANSACTION: {
    ID: 'large-transaction',
    NAME: 'Large Transaction Alert',
    THRESHOLD: 10000,
  },
  HIGH_VELOCITY: {
    ID: 'high-velocity',
    NAME: 'High Velocity Alert',
    TRANSACTION_COUNT: 5,
    TIME_WINDOW_MINUTES: 10,
  },
  RAPID_WITHDRAWAL: {
    ID: 'rapid-withdrawal',
    NAME: 'Rapid Withdrawal Pattern',
    TIME_WINDOW_MINUTES: 5,
  },
} as const;

// Alert severity constants
export const ALERT_SEVERITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type AlertSeverityType = (typeof ALERT_SEVERITIES)[keyof typeof ALERT_SEVERITIES];

// Fraud alert event type
export const FRAUD_ALERT_EVENT_TYPE = 'fraud-alert' as const;
