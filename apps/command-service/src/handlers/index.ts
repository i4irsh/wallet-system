export * from './deposit.handler';
export * from './withdraw.handler';
export * from './transfer.handler';

import { DepositHandler } from './deposit.handler';
import { WithdrawHandler } from './withdraw.handler';
import { TransferHandler } from './transfer.handler';

export const CommandHandlers = [
  DepositHandler,
  WithdrawHandler,
  TransferHandler,
];