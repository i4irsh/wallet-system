import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';

const ALLOWED_TAGS = ['Health', 'Wallet Operations', 'Queries'];

function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Wallet System API')
    .setDescription(
      `
## Overview
A high-performance, event-sourced wallet system built with CQRS architecture.
    `,
    )
    .setVersion('1.0')
    .addTag('Health', 'Service health check endpoints')
    .addTag('Wallet Operations', 'Deposit, withdraw, and transfer operations')
    .addTag('Queries', 'Read wallet balances and transaction history')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-idempotency-key',
        in: 'header',
        description: 'Unique key for idempotent operations (UUID recommended)',
      },
      'x-idempotency-key',
    )
    .build();
}

function sanitizeDocument(document: OpenAPIObject): OpenAPIObject {
  // Remove auto-generated controller tags
  document.tags = document.tags?.filter((tag) => ALLOWED_TAGS.includes(tag.name)) || [];

  // Remove empty or unwanted tags from each path operation
  Object.values(document.paths).forEach((pathItem: any) => {
    ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
      if (pathItem[method]?.tags) {
        pathItem[method].tags = pathItem[method].tags.filter((tag: string) => tag !== '' && ALLOWED_TAGS.includes(tag));
      }
    });
  });

  return document;
}

export function setupSwagger(app: INestApplication): void {
  const config = buildSwaggerConfig();
  const document = sanitizeDocument(SwaggerModule.createDocument(app, config));

  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Wallet System API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 2.5em; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });
}
