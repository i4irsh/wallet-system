import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiGatewayService } from './api-gateway.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

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
  async deposit(@Body() data: { accountId: string; amount: number }) {
    return firstValueFrom(
      this.commandClient.send({ cmd: 'deposit' }, data),
    );
  }

  @Get('balance/:accountId')
  async getBalance(@Param('accountId') accountId: string) {
    return firstValueFrom(
      this.queryClient.send({ cmd: 'get_balance' }, { accountId }),
    );
  }
}
