import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { RabbitMQConfig } from './rabbitmq.config';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
    private connection: amqp.Connection;
    private channel: amqp.Channel;
    private readonly logger = new Logger(RabbitMQService.name);

    constructor(
        @Inject('RABBITMQ_CONFIG') private readonly config: RabbitMQConfig,
    ) { }

    async onModuleInit(): Promise<void> {
        await this.connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.disconnect();
    }

    private async connect(): Promise<void> {
        try {
            this.connection = await amqp.connect(this.config.url);
            this.channel = await this.connection.createChannel();

            // Set up Dead Letter Exchange
            await this.channel.assertExchange(`${this.config.exchange}.dlx`, 'direct', {
                durable: true,
            });

            // Set up Dead Letter Queue
            await this.channel.assertQueue(this.config.deadLetterQueue, {
                durable: true,
            });

            await this.channel.bindQueue(
                this.config.deadLetterQueue,
                `${this.config.exchange}.dlx`,
                'dead-letter',
            );

            // Set up main exchange (topic for flexible routing)
            await this.channel.assertExchange(this.config.exchange, 'topic', {
                durable: true,
            });

            // Set up main queue with DLQ configuration
            await this.channel.assertQueue(this.config.queue, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': `${this.config.exchange}.dlx`,
                    'x-dead-letter-routing-key': 'dead-letter',
                },
            });

            // Bind queue to exchange for all wallet events
            await this.channel.bindQueue(
                this.config.queue,
                this.config.exchange,
                'wallet.#',
            );

            this.logger.log('Connected to RabbitMQ');
        } catch (error) {
            this.logger.error('Failed to connect to RabbitMQ', error);
            throw error;
        }
    }

    private async disconnect(): Promise<void> {
        try {
            await this.channel?.close();
            await this.connection?.close();
            this.logger.log('Disconnected from RabbitMQ');
        } catch (error) {
            this.logger.error('Error disconnecting from RabbitMQ', error);
        }
    }

    async publish(routingKey: string, message: any): Promise<void> {
        try {
            const content = Buffer.from(JSON.stringify(message));

            this.channel.publish(this.config.exchange, routingKey, content, {
                persistent: true,
                contentType: 'application/json',
                timestamp: Date.now(),
            });

            this.logger.debug(`Published message to ${routingKey}`, message);
        } catch (error) {
            this.logger.error(`Failed to publish message to ${routingKey}`, error);
            throw error;
        }
    }

    async consume(
        callback: (message: any, ack: () => void, nack: (requeue?: boolean) => void) => Promise<void>,
    ): Promise<void> {
        await this.channel.prefetch(1);

        await this.channel.consume(
            this.config.queue,
            async (msg) => {
                if (!msg) return;

                try {
                    const content = JSON.parse(msg.content.toString());

                    const ack = () => this.channel.ack(msg);
                    const nack = (requeue = false) => this.channel.nack(msg, false, requeue);

                    await callback(content, ack, nack);
                } catch (error) {
                    this.logger.error('Error processing message', error);
                    // Send to DLQ (don't requeue)
                    this.channel.nack(msg, false, false);
                }
            },
            { noAck: false },
        );

        this.logger.log(`Consuming messages from ${this.config.queue}`);
    }
}