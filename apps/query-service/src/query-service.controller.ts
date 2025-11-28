import { Controller } from '@nestjs/common';
import { QueryServiceService } from './query-service.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class QueryServiceController {
  constructor(private readonly queryServiceService: QueryServiceService) {}

  @MessagePattern({ cmd: 'ping' })
  ping(): string {
    return 'pong from query-service';
  }

  @MessagePattern({ cmd: 'get_balance' })
  getBalance(@Payload() data: { accountId: string }) {
    console.log('Get balance query received:', data);
    // Mock response for now
    return { accountId: data.accountId, balance: 1000 };
  }
}
