import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransferCommand } from '../commands';
import { WalletRepository } from '../repositories/wallet.repository';

@CommandHandler(TransferCommand)
export class TransferHandler implements ICommandHandler<TransferCommand> {
  constructor(private readonly walletRepository: WalletRepository) {}

  async execute(command: TransferCommand): Promise<{ success: boolean; message: string; fromBalance: number; toBalance: number }> {
    const { fromWalletId, toWalletId, amount } = command;

    // Load source wallet
    const fromWallet = await this.walletRepository.findById(fromWalletId);

    // Execute transfer out (validates balance)
    fromWallet.transferOut(toWalletId, amount);

    // Save source wallet events
    await this.walletRepository.save(fromWallet);

    // Load destination wallet and credit
    const toWallet = await this.walletRepository.findById(toWalletId);
    toWallet.deposit(amount);

    // Save destination wallet events
    await this.walletRepository.save(toWallet);

    return {
      success: true,
      message: `Transferred ${amount} from wallet ${fromWalletId} to wallet ${toWalletId}`,
      fromBalance: fromWallet.getBalance(),
      toBalance: toWallet.getBalance(),
    };
  }
}