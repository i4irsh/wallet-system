import { Module } from '@nestjs/common';
import { QueryServiceController } from './query-service.controller';
import { QueryServiceService } from './query-service.service';

@Module({
  imports: [],
  controllers: [QueryServiceController],
  providers: [QueryServiceService],
})
export class QueryServiceModule {}
