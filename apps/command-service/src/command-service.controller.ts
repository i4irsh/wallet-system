import { Controller } from '@nestjs/common';
import { CommandServiceService } from './command-service.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class CommandServiceController {
  constructor(private readonly commandServiceService: CommandServiceService) {}

  @MessagePattern({ cmd: 'ping' })
  ping(): string {
    return 'pong from command-service';
  }

  @MessagePattern({ cmd: 'deposit' })
  deposit(@Payload() data: { walletId: string; amount: number }) {
    console.log('Deposit command received:', data);
    return { success: true, message: `Deposited ${data.amount} to wallet ${data.walletId}` };
  }
}
