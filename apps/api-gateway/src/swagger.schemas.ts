import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger response schemas for OpenAPI documentation
 */

export class WalletResponse {
  @ApiProperty({
    description: 'Unique identifier for the wallet',
    example: 'wallet-001',
  })
  id: string;

  @ApiProperty({
    description: 'Current balance of the wallet',
    example: 1000.0,
  })
  balance: number;

  @ApiProperty({
    description: 'Timestamp when the wallet was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp of the last update to the wallet',
    example: '2024-01-15T14:45:30.000Z',
  })
  updatedAt: Date;
}

export class TransactionResponse {
  @ApiProperty({
    description: 'Unique identifier for the transaction',
    example: 'txn-abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Wallet ID associated with this transaction',
    example: 'wallet-001',
  })
  walletId: string;

  @ApiProperty({
    description: 'Type of transaction',
    enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT'],
    example: 'DEPOSIT',
  })
  type: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 100.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Timestamp when the transaction occurred',
    example: '2024-01-15T14:45:30.000Z',
  })
  timestamp: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata about the transaction',
    example: { relatedWalletId: 'wallet-002', sagaId: 'saga-xyz789' },
  })
  metadata?: Record<string, any>;
}

export class PingResponse {
  @ApiProperty({
    description: 'Command service status',
    example: 'pong',
  })
  commandService: string;

  @ApiProperty({
    description: 'Query service status',
    example: 'pong',
  })
  queryService: string;
}

export class ErrorResponse {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Insufficient balance',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error: string;
}
