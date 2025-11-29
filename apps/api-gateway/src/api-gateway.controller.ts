import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { DepositDto, WithdrawDto, TransferDto } from '@app/shared';

@Controller()
export class ApiGatewayController {
  constructor(
    @Inject('COMMAND_SERVICE') private commandClient: ClientProxy,
    @Inject('QUERY_SERVICE') private queryClient: ClientProxy,
  ) {}

  @Get('ping')
  async ping() {
    const commandPing = await firstValueFrom(
      this.commandClient.send({ cmd: 'ping' }, {}),
    );
    const queryPing = await firstValueFrom(
      this.queryClient.send({ cmd: 'ping' }, {}),
    );
    return { commandService: commandPing, queryService: queryPing };
  }

  @Post('deposit')
  async deposit(@Body() data: DepositDto) {
    return firstValueFrom(
      this.commandClient.send({ cmd: 'deposit' }, data),
    );
  }

  @Post('withdraw')
  async withdraw(@Body() data: WithdrawDto) {
    return firstValueFrom(
      this.commandClient.send({ cmd: 'withdraw' }, data),
    );
  }

  @Post('transfer')
  async transfer(@Body() data: TransferDto) {
    return firstValueFrom(
      this.commandClient.send({ cmd: 'transfer' }, data),
    );
  }

  @Get('balance/:walletId')
  async getBalance(@Param('walletId') walletId: string) {
    return firstValueFrom(
      this.queryClient.send({ cmd: 'get_balance' }, { walletId }),
    );
  }
}