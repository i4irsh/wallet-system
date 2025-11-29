import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandServiceController } from './command-service.controller';
import { CommandServiceService } from './command-service.service';
import { CommandHandlers } from './handlers';

@Module({
  imports: [CqrsModule],
  controllers: [CommandServiceController],
  providers: [CommandServiceService, ...CommandHandlers],
})
export class CommandServiceModule {}
