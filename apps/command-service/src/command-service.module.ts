import { Module } from '@nestjs/common';
import { CommandServiceController } from './command-service.controller';
import { CommandServiceService } from './command-service.service';

@Module({
  imports: [],
  controllers: [CommandServiceController],
  providers: [CommandServiceService],
})
export class CommandServiceModule {}
