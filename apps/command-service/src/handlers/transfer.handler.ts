import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransferCommand } from '../commands';
import { WalletRepository } from '../repositories/wallet.repository';
import { EventPublisherService } from '../publishers/event.publisher';
import { MoneyTransferredEvent } from '@app/shared';

@CommandHandler(TransferCommand)
export class TransferHandler implements ICommandHandler<TransferCommand> {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: TransferCommand): Promise<{ success: boolean; message: string; fromBalance: number; toBalance: number }> {
    const { fromWalletId, toWalletId, amount } = command;

    // Load source wallet
    const fromWallet = await this.walletRepository.findById(fromWalletId);

    fromWallet.transferOut(toWalletId, amount);

    // Capture event before save (commit clears uncommitted events)
    const fromEvents = fromWallet.getUncommittedEvents();
    const lastFromEvent = fromEvents[fromEvents.length - 1] as MoneyTransferredEvent;

    await this.walletRepository.save(fromWallet);

    // Load destination wallet and credit
    const toWallet = await this.walletRepository.findById(toWalletId);
    toWallet.deposit(amount);

    await this.walletRepository.save(toWallet);

    // Publish transfer event to query service
    await this.eventPublisher.publishMoneyTransferred({
      fromWalletId,
      toWalletId,
      amount,
      timestamp: lastFromEvent.timestamp,
      transactionId: lastFromEvent.transactionId,
      fromBalanceAfter: fromWallet.getBalance(),
      toBalanceAfter: toWallet.getBalance(),
    });

    return {
      success: true,
      message: `Transferred ${amount} from wallet ${fromWalletId} to wallet ${toWalletId}`,
      fromBalance: fromWallet.getBalance(),
      toBalance: toWallet.getBalance(),
    };
  }
}