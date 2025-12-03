export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  exchange: string;
  queue: string;
  deadLetterQueue: string;
}
