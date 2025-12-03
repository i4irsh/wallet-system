import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({
    description: 'Unique identifier for the wallet',
    example: 'wallet-001',
    type: String,
  })
  walletId: string;

  @ApiProperty({
    description: 'Amount to withdraw (must be positive and not exceed balance)',
    example: 50.0,
    minimum: 0.01,
    type: Number,
  })
  amount: number;
}
