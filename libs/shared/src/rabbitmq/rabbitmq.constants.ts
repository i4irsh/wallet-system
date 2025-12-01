export const RABBITMQ_EXCHANGES = {
    WALLET_EVENTS: 'wallet.events',
} as const;

export const RABBITMQ_QUEUES = {
    WALLET_EVENTS: 'wallet.events.queue',
    WALLET_EVENTS_DLQ: 'wallet.events.dlq',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
    MONEY_DEPOSITED: 'wallet.money.deposited',
    MONEY_WITHDRAWN: 'wallet.money.withdrawn',
    MONEY_TRANSFERRED: 'wallet.money.transferred',
    ALL_EVENTS: 'wallet.#',
} as const;