import { ICommand } from '@nestjs/cqrs';

export class WithdrawCommand implements ICommand {
  constructor(
    public readonly walletId: string,
    public readonly amount: number,
  ) {}
}
