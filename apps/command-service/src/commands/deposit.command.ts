import { ICommand } from '@nestjs/cqrs';

export class DepositCommand implements ICommand {
  constructor(
    public readonly walletId: string,
    public readonly amount: number,
  ) {}
}