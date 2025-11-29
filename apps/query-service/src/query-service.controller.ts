import type { IWallet } from '@app/shared';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class QueryServiceController {
  @MessagePattern({ cmd: 'ping' })
  ping(): string {
    return 'pong from query-service';
  }

  @MessagePattern({ cmd: 'get_balance' })
  getBalance(@Payload() data: { walletId: string }): IWallet {
    console.log('Get balance query received:', data);
    // Mock response for now
    return {
      id: data.walletId,
      balance: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
