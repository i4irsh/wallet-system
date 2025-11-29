import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { TransferCommand } from '../commands';
import { WalletAggregate } from '../aggregates/wallet.aggregate';

@CommandHandler(TransferCommand)
export class TransferHandler implements ICommandHandler<TransferCommand> {
  constructor(private readonly eventPublisher: EventPublisher) {}

  async execute(command: TransferCommand): Promise<{ success: boolean; message: string }> {
    const { fromWalletId, toWalletId, amount } = command;

    const fromWallet = this.eventPublisher.mergeObjectContext(
      new WalletAggregate(fromWalletId),
    );

    fromWallet.transferOut(toWalletId, amount);
    fromWallet.commit();

    return {
      success: true,
      message: `Transferred ${amount} from wallet ${fromWalletId} to wallet ${toWalletId}`,
    };
  }
}