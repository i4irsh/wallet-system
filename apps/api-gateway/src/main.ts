import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@app/shared';
import { ApiGatewayModule } from './api-gateway.module';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>(ENV.API_GATEWAY_PORT)!;

  setupSwagger(app);

  await app.listen(port);
  console.log(`API Gateway is listening on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api`);
}
void bootstrap();
