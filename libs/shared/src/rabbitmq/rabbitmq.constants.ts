export const RABBITMQ_EXCHANGES = {
  WALLET_EVENTS: 'wallet.events',
} as const;

export const RABBITMQ_QUEUES = {
  WALLET_EVENTS: 'wallet.events.queue',
  WALLET_EVENTS_DLQ: 'wallet.events.dlq',
  FRAUD_EVENTS: 'fraud.events.queue',
  FRAUD_EVENTS_DLQ: 'fraud.events.dlq',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  // Basic wallet events
  MONEY_DEPOSITED: 'wallet.money.deposited',
  MONEY_WITHDRAWN: 'wallet.money.withdrawn',
  MONEY_TRANSFERRED: 'wallet.money.transferred',

  // Saga events
  TRANSFER_INITIATED: 'wallet.transfer.initiated',
  SOURCE_DEBITED: 'wallet.transfer.source.debited',
  DESTINATION_CREDITED: 'wallet.transfer.destination.credited',
  TRANSFER_COMPLETED: 'wallet.transfer.completed',
  TRANSFER_FAILED: 'wallet.transfer.failed',
  COMPENSATION_INITIATED: 'wallet.transfer.compensation.initiated',
  SOURCE_REFUNDED: 'wallet.transfer.source.refunded',

  // Wildcard patterns
  ALL_EVENTS: 'wallet.#',
} as const;
