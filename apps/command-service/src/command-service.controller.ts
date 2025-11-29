import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DepositDto, WithdrawDto, TransferDto } from '@app/shared';

@Controller()
export class CommandServiceController {
  @MessagePattern({ cmd: 'ping' })
  ping(): string {
    return 'pong from command-service';
  }

  @MessagePattern({ cmd: 'deposit' })
  deposit(@Payload() data: DepositDto) {
    console.log('Deposit command received:', data);
    return { 
      success: true, 
      message: `Deposited ${data.amount} to wallet ${data.walletId}` 
    };
  }

  @MessagePattern({ cmd: 'withdraw' })
  withdraw(@Payload() data: WithdrawDto) {
    console.log('Withdraw command received:', data);
    return { 
      success: true, 
      message: `Withdrew ${data.amount} from wallet ${data.walletId}` 
    };
  }

  @MessagePattern({ cmd: 'transfer' })
  transfer(@Payload() data: TransferDto) {
    console.log('Transfer command received:', data);
    return { 
      success: true, 
      message: `Transferred ${data.amount} from wallet ${data.fromWalletId} to wallet ${data.toWalletId}` 
    };
  }
}