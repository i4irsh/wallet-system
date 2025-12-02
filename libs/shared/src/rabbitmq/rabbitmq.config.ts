export interface RabbitMQConfig {
    url: string;
    exchange: string;
    queue: string;
    deadLetterQueue: string;
}

export const getRabbitMQConfig = (): RabbitMQConfig => ({
    url: process.env.RABBITMQ_URL || 'amqp://wallet_user:wallet_password@localhost:5672',
    exchange: 'wallet.events',
    queue: 'wallet.events.queue',
    deadLetterQueue: 'wallet.events.dlq',
});

export const getFraudRabbitMQConfig = (): RabbitMQConfig => ({
    url: process.env.RABBITMQ_URL || 'amqp://wallet_user:wallet_password@localhost:5672',
    exchange: 'wallet.events',
    queue: 'fraud.events.queue',
    deadLetterQueue: 'fraud.events.dlq',
});