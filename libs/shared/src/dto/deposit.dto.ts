import { ApiProperty } from '@nestjs/swagger';

export class DepositDto {
  @ApiProperty({
    description: 'Unique identifier for the wallet',
    example: 'wallet-001',
    type: String,
  })
  walletId: string;

  @ApiProperty({
    description: 'Amount to deposit (must be positive)',
    example: 100.0,
    minimum: 0.01,
    type: Number,
  })
  amount: number;
}
