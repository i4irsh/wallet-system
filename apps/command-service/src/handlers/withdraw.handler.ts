import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { WithdrawCommand } from '../commands';
import { WalletRepository } from '../repositories/wallet.repository';
import { EventPublisherService } from '../publishers/event.publisher';
import { MoneyWithdrawnEvent } from '@app/shared';

@CommandHandler(WithdrawCommand)
export class WithdrawHandler implements ICommandHandler<WithdrawCommand> {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: WithdrawCommand): Promise<{ success: boolean; message: string; balance: number }> {
    const { walletId, amount } = command;

    const wallet = await this.walletRepository.findById(walletId);

    wallet.withdraw(amount);

    // Capture event before save (commit clears uncommitted events)
    const uncommittedEvents = wallet.getUncommittedEvents();
    const lastEvent = uncommittedEvents[uncommittedEvents.length - 1] as MoneyWithdrawnEvent;

    await this.walletRepository.save(wallet);

    // Publish event to query service
    await this.eventPublisher.publishMoneyWithdrawn({
      walletId,
      amount,
      timestamp: lastEvent.timestamp,
      transactionId: lastEvent.transactionId,
      balanceAfter: wallet.getBalance(),
    });

    return {
      success: true,
      message: `Withdrew ${amount} from wallet ${walletId}`,
      balance: wallet.getBalance(),
    };
  }
}