import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ENV } from '@app/shared';
import { QueryServiceModule } from './query-service.module';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(QueryServiceModule);
  const configService = appContext.get(ConfigService);
  const host = configService.get<string>(ENV.QUERY_SERVICE_HOST)!;
  const port = configService.get<number>(ENV.QUERY_SERVICE_PORT)!;
  await appContext.close();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(QueryServiceModule, {
    transport: Transport.TCP,
    options: {
      host,
      port,
    },
  });
  await app.listen();
  console.log(`Query Service is listening on ${host}:${port}`);
}
void bootstrap();
