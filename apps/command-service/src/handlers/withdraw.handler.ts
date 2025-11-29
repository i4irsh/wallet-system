import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { WithdrawCommand } from '../commands';
import { WalletRepository } from '../repositories/wallet.repository';

@CommandHandler(WithdrawCommand)
export class WithdrawHandler implements ICommandHandler<WithdrawCommand> {
  constructor(private readonly walletRepository: WalletRepository) {}

  async execute(command: WithdrawCommand): Promise<{ success: boolean; message: string; balance: number }> {
    const { walletId, amount } = command;

    const wallet = await this.walletRepository.findById(walletId);

    wallet.withdraw(amount);

    await this.walletRepository.save(wallet);

    return {
      success: true,
      message: `Withdrew ${amount} from wallet ${walletId}`,
      balance: wallet.getBalance(),
    };
  }
}