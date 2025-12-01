import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransferCommand } from '../commands';
import { TransferSagaService, TransferResult } from '../sagas/transfer-saga.service';

@CommandHandler(TransferCommand)
export class TransferHandler implements ICommandHandler<TransferCommand> {
  constructor(private readonly transferSagaService: TransferSagaService) {}

  async execute(command: TransferCommand): Promise<TransferResult> {
    const { fromWalletId, toWalletId, amount } = command;

    return this.transferSagaService.execute(fromWalletId, toWalletId, amount);
  }
}