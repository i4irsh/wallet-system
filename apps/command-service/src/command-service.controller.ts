import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DepositDto, WithdrawDto, TransferDto, MESSAGE_PATTERNS } from '@app/shared';
import { CommandBus } from '@nestjs/cqrs';
import { DepositCommand, WithdrawCommand, TransferCommand } from './commands';

@Controller()
export class CommandServiceController {
  constructor(private readonly commandBus: CommandBus) {}

  @MessagePattern({ cmd: MESSAGE_PATTERNS.PING })
  ping(): string {
    return 'pong from command-service';
  }

  @MessagePattern({ cmd: MESSAGE_PATTERNS.DEPOSIT })
  async deposit(@Payload() data: DepositDto) {
    return this.commandBus.execute(new DepositCommand(data.walletId, data.amount));
  }

  @MessagePattern({ cmd: MESSAGE_PATTERNS.WITHDRAW })
  async withdraw(@Payload() data: WithdrawDto) {
    return this.commandBus.execute(new WithdrawCommand(data.walletId, data.amount));
  }

  @MessagePattern({ cmd: MESSAGE_PATTERNS.TRANSFER })
  async transfer(@Payload() data: TransferDto) {
    return this.commandBus.execute(new TransferCommand(data.fromWalletId, data.toWalletId, data.amount));
  }
}
