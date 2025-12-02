import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DepositCommand } from '../commands';
import { WalletRepository } from '../repositories/wallet.repository';
import { EventPublisherService } from '../publishers/event.publisher';
import { MoneyDepositedEvent } from '@app/shared';

@CommandHandler(DepositCommand)
export class DepositHandler implements ICommandHandler<DepositCommand> {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: DepositCommand): Promise<{ success: boolean; message: string; balance: number }> {
    const { walletId, amount } = command;

    const wallet = await this.walletRepository.findById(walletId);

    wallet.deposit(amount);

    // Capture event before save (commit clears uncommitted events)
    const uncommittedEvents = wallet.getUncommittedEvents();
    const lastEvent = uncommittedEvents[uncommittedEvents.length - 1] as MoneyDepositedEvent;

    await this.walletRepository.save(wallet);

    // Publish event to query service
    await this.eventPublisher.publishMoneyDeposited({
      walletId,
      amount,
      timestamp: lastEvent.timestamp,
      transactionId: lastEvent.transactionId,
      balanceAfter: wallet.getBalance(),
    });

    return {
      success: true,
      message: `Deposited ${amount} to wallet ${walletId}`,
      balance: wallet.getBalance(),
    };
  }
}
