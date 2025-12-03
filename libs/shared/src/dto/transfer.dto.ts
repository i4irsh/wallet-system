import { ApiProperty } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({
    description: 'Wallet ID to transfer funds from',
    example: 'wallet-001',
    type: String,
  })
  fromWalletId: string;

  @ApiProperty({
    description: 'Wallet ID to transfer funds to',
    example: 'wallet-002',
    type: String,
  })
  toWalletId: string;

  @ApiProperty({
    description: 'Amount to transfer (must be positive and not exceed source balance)',
    example: 25.0,
    minimum: 0.01,
    type: Number,
  })
  amount: number;
}
