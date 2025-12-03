import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ENV } from '@app/shared';
import { CommandServiceModule } from './command-service.module';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(CommandServiceModule);
  const configService = appContext.get(ConfigService);
  const host = configService.get<string>(ENV.COMMAND_SERVICE_HOST)!;
  const port = configService.get<number>(ENV.COMMAND_SERVICE_PORT)!;
  await appContext.close();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(CommandServiceModule, {
    transport: Transport.TCP,
    options: {
      host,
      port,
    },
  });
  await app.listen();
  console.log(`Command Service is listening on ${host}:${port}`);
}
void bootstrap();
