import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader, ApiSecurity } from '@nestjs/swagger';
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
import { WalletResponse, TransactionResponse, PingResponse } from './swagger.schemas';

@Controller()
export class ApiGatewayController {
  constructor(
    @Inject(MICROSERVICE_TOKENS.COMMAND_SERVICE) private commandClient: ClientProxy,
    @Inject(MICROSERVICE_TOKENS.QUERY_SERVICE) private queryClient: ClientProxy,
  ) {}

  @Get('ping')
  @ApiTags('Health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Verifies connectivity to command and query microservices',
  })
  @ApiResponse({
    status: 200,
    description: 'Services are healthy',
    type: PingResponse,
  })
  @ApiResponse({
    status: 503,
    description: 'One or more services are unavailable',
  })
  async ping(): Promise<PingResponse> {
    const commandPing = await firstValueFrom<string>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.PING }, {}));
    const queryPing = await firstValueFrom<string>(this.queryClient.send({ cmd: MESSAGE_PATTERNS.PING }, {}));
    return { commandService: commandPing, queryService: queryPing };
  }

  @Post('deposit')
  @RequireIdempotency()
  @ApiTags('Wallet Operations')
  @ApiOperation({
    summary: 'Deposit funds',
    description: 'Deposit funds into a wallet. Creates the wallet if it does not exist.',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    description: 'Unique key to ensure idempotent operation (UUID recommended)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiSecurity('x-idempotency-key')
  @ApiResponse({
    status: 201,
    description: 'Deposit successful',
    type: WalletResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (negative amount, missing fields)',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate idempotency key with different payload',
  })
  async deposit(@Body() data: DepositDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.DEPOSIT }, data));
  }

  @Post('withdraw')
  @RequireIdempotency()
  @ApiTags('Wallet Operations')
  @ApiOperation({
    summary: 'Withdraw funds',
    description: 'Withdraw funds from a wallet. Fails if insufficient balance.',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    description: 'Unique key to ensure idempotent operation (UUID recommended)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiSecurity('x-idempotency-key')
  @ApiResponse({
    status: 201,
    description: 'Withdrawal successful',
    type: WalletResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (negative amount, insufficient funds)',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate idempotency key with different payload',
  })
  async withdraw(@Body() data: WithdrawDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.WITHDRAW }, data));
  }

  @Post('transfer')
  @RequireIdempotency()
  @ApiTags('Wallet Operations')
  @ApiOperation({
    summary: 'Transfer funds',
    description:
      'Transfer funds between wallets using the Saga pattern. Ensures atomic operation with automatic rollback on failure.',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    description: 'Unique key to ensure idempotent operation (UUID recommended)',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @ApiSecurity('x-idempotency-key')
  @ApiResponse({
    status: 201,
    description: 'Transfer successful',
    type: WalletResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (negative amount, same source/destination, insufficient funds)',
  })
  @ApiResponse({
    status: 404,
    description: 'Source or destination wallet not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate idempotency key with different payload',
  })
  async transfer(@Body() data: TransferDto): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.commandClient.send({ cmd: MESSAGE_PATTERNS.TRANSFER }, data));
  }

  @Get('balance/:walletId')
  @ApiTags('Queries')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Retrieves the current balance and metadata for a wallet',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Unique identifier for the wallet',
    example: 'wallet-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet found',
    type: WalletResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  async getBalance(@Param('walletId') walletId: string): Promise<IWallet> {
    return firstValueFrom<IWallet>(this.queryClient.send({ cmd: MESSAGE_PATTERNS.GET_BALANCE }, { walletId }));
  }

  @Get('transactions/:walletId')
  @ApiTags('Queries')
  @ApiOperation({
    summary: 'Get transaction history',
    description: 'Retrieves all transactions for a wallet, ordered by timestamp descending',
  })
  @ApiParam({
    name: 'walletId',
    description: 'Unique identifier for the wallet',
    example: 'wallet-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved',
    type: [TransactionResponse],
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  async getTransactions(@Param('walletId') walletId: string): Promise<ITransaction[]> {
    return firstValueFrom<ITransaction[]>(
      this.queryClient.send({ cmd: MESSAGE_PATTERNS.GET_TRANSACTIONS }, { walletId }),
    );
  }
}
