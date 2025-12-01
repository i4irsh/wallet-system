import { Module, DynamicModule, Global } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQConfig } from './rabbitmq.config';

@Global()
@Module({})
export class RabbitMQModule {
    static forRoot(config: RabbitMQConfig): DynamicModule {
        return {
            module: RabbitMQModule,
            providers: [
                {
                    provide: 'RABBITMQ_CONFIG',
                    useValue: config,
                },
                RabbitMQService,
            ],
            exports: [RabbitMQService],
        };
    }
}