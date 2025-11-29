import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { WithdrawCommand } from '../commands';
import { WalletAggregate } from '../aggregates/wallet.aggregate';

@CommandHandler(WithdrawCommand)
export class WithdrawHandler implements ICommandHandler<WithdrawCommand> {
  constructor(private readonly eventPublisher: EventPublisher) {}

  async execute(command: WithdrawCommand): Promise<{ success: boolean; message: string }> {
    const { walletId, amount } = command;

    const wallet = this.eventPublisher.mergeObjectContext(
      new WalletAggregate(walletId),
    );

    wallet.withdraw(amount);
    wallet.commit();

    return {
      success: true,
      message: `Withdrew ${amount} from wallet ${walletId}`,
    };
  }
}