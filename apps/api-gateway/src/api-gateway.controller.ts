import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { DepositDto, WithdrawDto, TransferDto, IWallet, ITransaction, RequireIdempotency } from '@app/shared';

interface PingResponse {
  commandService: string;
  queryService: string;
}

@Controller()
export class ApiGatewayController {
  constructor(
    @Inject('COMMAND_SERVICE') private commandClient: ClientProxy,
    @Inject('QUERY_SERVICE') private queryClient: ClientProxy,
  ) {}

  @Get('ping')
  async ping(): Promise<PingResponse> {
    const commandPing = await firstValueFrom<string>(this.commandClient.send({ cmd: 'ping' }, {}));
    const queryPing = await firstValueFrom<string>(this.queryClient.send({ cmd: 'ping' }, {}));
    return { commandService: commandPing, queryService: queryPing };
  }

  @Post('deposit')
  @RequireIdempotency()
  async deposit(@Body() data: DepositDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: 'deposit' }, data));
  }

  @Post('withdraw')
  @RequireIdempotency()
  async withdraw(@Body() data: WithdrawDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: 'withdraw' }, data));
  }

  @Post('transfer')
  @RequireIdempotency()
  async transfer(@Body() data: TransferDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: 'transfer' }, data));
  }

  @Get('balance/:walletId')
  async getBalance(@Param('walletId') walletId: string): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.queryClient.send({ cmd: 'get_balance' }, { walletId }));
  }

  @Get('transactions/:walletId')
  async getTransactions(@Param('walletId') walletId: string): Promise<ITransaction[]> {
    return firstValueFrom<ITransaction[]>(this.queryClient.send({ cmd: 'get_transactions' }, { walletId }));
  }
}
