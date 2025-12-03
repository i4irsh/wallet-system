import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@app/shared';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>(ENV.API_GATEWAY_PORT)!;
  await app.listen(port);
  console.log(`API Gateway is listening on port ${port}`);
}
void bootstrap();
