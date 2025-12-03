import { ICommand } from '@nestjs/cqrs';

export class TransferCommand implements ICommand {
  constructor(
    public readonly fromWalletId: string,
    public readonly toWalletId: string,
    public readonly amount: number,
  ) {}
}
