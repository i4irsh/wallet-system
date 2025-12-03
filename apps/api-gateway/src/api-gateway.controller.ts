import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  DepositDto,
  WithdrawDto,
  TransferDto,
  IWallet,
  ITransaction,
  RequireIdempotency,
  MICROSERVICE_TOKENS,
  MESSAGE_PATTERNS,
} from '@app/shared';

interface PingResponse {
  commandService: string;
  queryService: string;
}

@Controller()
export class ApiGatewayController {
  constructor(
    @Inject(MICROSERVICE_TOKENS.COMMAND_SERVICE) private commandClient: ClientProxy,
    @Inject(MICROSERVICE_TOKENS.QUERY_SERVICE) private queryClient: ClientProxy,
  ) {}

  @Get('ping')
  async ping(): Promise<PingResponse> {
    const commandPing = await firstValueFrom<string>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.PING }, {}));
    const queryPing = await firstValueFrom<string>(this.queryClient.send({ cmd: MESSAGE_PATTERNS.PING }, {}));
    return { commandService: commandPing, queryService: queryPing };
  }

  @Post('deposit')
  @RequireIdempotency()
  async deposit(@Body() data: DepositDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.DEPOSIT }, data));
  }

  @Post('withdraw')
  @RequireIdempotency()
  async withdraw(@Body() data: WithdrawDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.WITHDRAW }, data));
  }

  @Post('transfer')
  @RequireIdempotency()
  async transfer(@Body() data: TransferDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.TRANSFER }, data));
  }

  @Get('balance/:walletId')
  async getBalance(@Param('walletId') walletId: string): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.queryClient.send({ cmd: MESSAGE_PATTERNS.GET_BALANCE }, { walletId }));
  }

  @Get('transactions/:walletId')
  async getTransactions(@Param('walletId') walletId: string): Promise<ITransaction[]> {
    return firstValueFrom<ITransaction[]>(
      this.queryClient.send({ cmd: MESSAGE_PATTERNS.GET_TRANSACTIONS }, { walletId }),
    );
  }
}
