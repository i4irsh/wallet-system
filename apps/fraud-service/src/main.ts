import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ENV } from '@app/shared';
import { FraudServiceModule } from './fraud-service.module';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(FraudServiceModule);
  const configService = appContext.get(ConfigService);
  const host = configService.get<string>(ENV.FRAUD_SERVICE_HOST)!;
  const port = configService.get<number>(ENV.FRAUD_SERVICE_PORT)!;
  await appContext.close();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(FraudServiceModule, {
    transport: Transport.TCP,
    options: {
      host,
      port,
    },
  });
  await app.listen();
  console.log(`Fraud Service is listening on ${host}:${port}`);
}
void bootstrap();
