import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DepositCommand } from '../commands';
import { WalletRepository } from '../repositories/wallet.repository';

@CommandHandler(DepositCommand)
export class DepositHandler implements ICommandHandler<DepositCommand> {
  constructor(private readonly walletRepository: WalletRepository) {}

  async execute(command: DepositCommand): Promise<{ success: boolean; message: string; balance: number }> {
    const { walletId, amount } = command;

    // Load aggregate from event store (replays events)
    const wallet = await this.walletRepository.findById(walletId);

    // Execute business logic
    wallet.deposit(amount);

    // Save events to event store
    await this.walletRepository.save(wallet);

    return {
      success: true,
      message: `Deposited ${amount} to wallet ${walletId}`,
      balance: wallet.getBalance(),
    };
  }
}