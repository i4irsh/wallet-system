import * as Joi from 'joi';
import { ENV } from './config.constants';

// Common validation schema for all services
export const baseConfigSchema = {
  [ENV.NODE_ENV]: Joi.string().valid('development', 'production', 'test').default('development'),
};

// RabbitMQ schema - shared across services that use RabbitMQ
export const rabbitMQSchema = {
  [ENV.RABBITMQ_HOST]: Joi.string().required(),
  [ENV.RABBITMQ_PORT]: Joi.number().required(),
  [ENV.RABBITMQ_USER]: Joi.string().required(),
  [ENV.RABBITMQ_PASSWORD]: Joi.string().required(),
};

// API Gateway specific schema
export const apiGatewayConfigSchema = Joi.object({
  ...baseConfigSchema,
  [ENV.API_GATEWAY_PORT]: Joi.number().required(),
  [ENV.COMMAND_SERVICE_HOST]: Joi.string().required(),
  [ENV.COMMAND_SERVICE_PORT]: Joi.number().required(),
  [ENV.QUERY_SERVICE_HOST]: Joi.string().required(),
  [ENV.QUERY_SERVICE_PORT]: Joi.number().required(),
  // Redis config for idempotency
  [ENV.REDIS_HOST]: Joi.string().required(),
  [ENV.REDIS_PORT]: Joi.number().required(),
});

// Command Service specific schema
export const commandServiceConfigSchema = Joi.object({
  ...baseConfigSchema,
  [ENV.COMMAND_SERVICE_HOST]: Joi.string().required(),
  [ENV.COMMAND_SERVICE_PORT]: Joi.number().required(),
  // Write Database
  [ENV.DB_WRITE_HOST]: Joi.string().required(),
  [ENV.DB_WRITE_PORT]: Joi.number().required(),
  [ENV.DB_WRITE_USERNAME]: Joi.string().required(),
  [ENV.DB_WRITE_PASSWORD]: Joi.string().required(),
  [ENV.DB_WRITE_DATABASE]: Joi.string().required(),
  // RabbitMQ
  ...rabbitMQSchema,
});

// Query Service specific schema
export const queryServiceConfigSchema = Joi.object({
  ...baseConfigSchema,
  [ENV.QUERY_SERVICE_HOST]: Joi.string().required(),
  [ENV.QUERY_SERVICE_PORT]: Joi.number().required(),
  // Read Database
  [ENV.DB_READ_HOST]: Joi.string().required(),
  [ENV.DB_READ_PORT]: Joi.number().required(),
  [ENV.DB_READ_USERNAME]: Joi.string().required(),
  [ENV.DB_READ_PASSWORD]: Joi.string().required(),
  [ENV.DB_READ_DATABASE]: Joi.string().required(),
  // RabbitMQ
  ...rabbitMQSchema,
});

// Fraud Service specific schema
export const fraudServiceConfigSchema = Joi.object({
  ...baseConfigSchema,
  [ENV.FRAUD_SERVICE_HOST]: Joi.string().required(),
  [ENV.FRAUD_SERVICE_PORT]: Joi.number().required(),
  // Fraud Database
  [ENV.DB_FRAUD_HOST]: Joi.string().required(),
  [ENV.DB_FRAUD_PORT]: Joi.number().required(),
  [ENV.DB_FRAUD_USERNAME]: Joi.string().required(),
  [ENV.DB_FRAUD_PASSWORD]: Joi.string().required(),
  [ENV.DB_FRAUD_DATABASE]: Joi.string().required(),
  // RabbitMQ
  ...rabbitMQSchema,
});
