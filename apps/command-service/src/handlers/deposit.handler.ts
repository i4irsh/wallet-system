import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { DepositCommand } from '../commands';
import { WalletAggregate } from '../aggregates/wallet.aggregate';

@CommandHandler(DepositCommand)
export class DepositHandler implements ICommandHandler<DepositCommand> {
  constructor(private readonly eventPublisher: EventPublisher) {}

  async execute(command: DepositCommand): Promise<{ success: boolean; message: string }> {
    const { walletId, amount } = command;

    // Create or load aggregate (we'll add proper loading later with event sourcing)
    const wallet = this.eventPublisher.mergeObjectContext(
      new WalletAggregate(walletId),
    );

    // Execute business logic
    wallet.deposit(amount);

    // Commit events (publishes to event bus)
    wallet.commit();

    return {
      success: true,
      message: `Deposited ${amount} to wallet ${walletId}`,
    };
  }
}