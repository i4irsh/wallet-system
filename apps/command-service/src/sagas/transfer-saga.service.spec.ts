/**
 * Unit Tests for TransferSagaService
 *
 * Tests the saga compensation pattern - specifically when:
 * 1. Source wallet is debited successfully
 * 2. Destination wallet credit fails
 * 3. Source wallet is compensated (refunded)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TransferSagaService } from './transfer-saga.service';
import { WalletRepository } from '../repositories/wallet.repository';
import { TransferSagaRepository } from './transfer-saga.repository';
import { EventPublisherService } from '../publishers/event.publisher';
import { WalletAggregate } from '../aggregates/wallet.aggregate';

describe('TransferSagaService', () => {
  let service: TransferSagaService;
  let walletRepository: jest.Mocked<WalletRepository>;
  let sagaRepository: jest.Mocked<TransferSagaRepository>;
  let eventPublisher: jest.Mocked<EventPublisherService>;

  // Mock wallet that tracks operations
  const createMockWallet = (id: string, initialBalance: number) => {
    let balance = initialBalance;
    const events: unknown[] = [];

    return {
      id,
      getBalance: jest.fn(() => balance),
      getUncommittedEvents: jest.fn(() => events),
      deposit: jest.fn((amount: number) => {
        balance += amount;
        events.push({
          type: 'MoneyDeposited',
          transactionId: `txn-deposit-${Date.now()}`,
          amount,
          timestamp: new Date(),
        });
      }),
      withdraw: jest.fn((amount: number) => {
        if (amount > balance) {
          throw new Error('Insufficient funds');
        }
        balance -= amount;
        events.push({
          type: 'MoneyWithdrawn',
          transactionId: `txn-withdraw-${Date.now()}`,
          amount,
          timestamp: new Date(),
        });
      }),
    } as unknown as WalletAggregate;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferSagaService,
        {
          provide: WalletRepository,
          useValue: {
            findById: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: TransferSagaRepository,
          useValue: {
            create: jest.fn(),
            setSourceDebited: jest.fn(),
            setCompleted: jest.fn(),
            setCompensating: jest.fn(),
            setFailed: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: EventPublisherService,
          useValue: {
            publishTransferInitiated: jest.fn(),
            publishSourceWalletDebited: jest.fn(),
            publishDestinationWalletCredited: jest.fn(),
            publishTransferCompleted: jest.fn(),
            publishTransferFailed: jest.fn(),
            publishCompensationInitiated: jest.fn(),
            publishSourceWalletRefunded: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransferSagaService>(TransferSagaService);
    walletRepository = module.get(WalletRepository);
    sagaRepository = module.get(TransferSagaRepository);
    eventPublisher = module.get(EventPublisherService);
  });

  describe('Happy Path', () => {
    it('should complete transfer successfully', async () => {
      const fromWallet = createMockWallet('wallet-a', 500);
      const toWallet = createMockWallet('wallet-b', 100);

      walletRepository.findById
        .mockResolvedValueOnce(fromWallet) // debit source
        .mockResolvedValueOnce(toWallet); // credit destination

      const result = await service.execute('wallet-a', 'wallet-b', 200);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Transferred 200');
      expect(fromWallet.withdraw).toHaveBeenCalledWith(200);
      expect(toWallet.deposit).toHaveBeenCalledWith(200);
      expect(sagaRepository.setCompleted).toHaveBeenCalled();
      expect(eventPublisher.publishTransferCompleted).toHaveBeenCalled();
    });
  });

  describe('Compensation Flow', () => {
    it('should compensate source wallet when destination credit fails', async () => {
      // This is the key scenario:
      // 1. wallet-a gets debited successfully
      // 2. wallet-b credit fails (simulated by throwing on second findById)
      // 3. wallet-a should be compensated (refunded)

      const fromWallet = createMockWallet('wallet-a', 500);

      // First call: debit source (success)
      // Second call: credit destination (throws error)
      // Third call: compensation/refund source (success)
      walletRepository.findById
        .mockResolvedValueOnce(fromWallet) // debit source - success
        .mockRejectedValueOnce(new Error('Database connection failed')) // credit destination - FAILS
        .mockResolvedValueOnce(fromWallet); // compensation - success

      const result = await service.execute('wallet-a', 'wallet-b', 200);

      // Transfer should fail
      expect(result.success).toBe(false);
      expect(result.message).toContain('Funds refunded');

      // Verify compensation was triggered
      expect(sagaRepository.setCompensating).toHaveBeenCalled();
      expect(eventPublisher.publishCompensationInitiated).toHaveBeenCalled();

      // Verify source wallet was refunded (deposit called for compensation)
      expect(fromWallet.withdraw).toHaveBeenCalledWith(200); // Initial debit
      expect(fromWallet.deposit).toHaveBeenCalledWith(200); // Compensation refund

      // Final saga state should be FAILED with compensation transaction
      expect(sagaRepository.setFailed).toHaveBeenCalled();
      expect(eventPublisher.publishTransferFailed).toHaveBeenCalled();
      expect(eventPublisher.publishSourceWalletRefunded).toHaveBeenCalled();
    });

    it('should compensate when destination wallet save fails', async () => {
      const fromWallet = createMockWallet('wallet-a', 500);
      const toWallet = createMockWallet('wallet-b', 100);

      walletRepository.findById
        .mockResolvedValueOnce(fromWallet) // debit source - success
        .mockResolvedValueOnce(toWallet) // credit destination - find succeeds
        .mockResolvedValueOnce(fromWallet); // compensation

      // First save succeeds (source debit), second fails (destination credit)
      walletRepository.save
        .mockResolvedValueOnce(undefined) // source debit save - success
        .mockRejectedValueOnce(new Error('Write conflict')) // destination save - FAILS
        .mockResolvedValueOnce(undefined); // compensation save - success

      const result = await service.execute('wallet-a', 'wallet-b', 200);

      expect(result.success).toBe(false);
      expect(sagaRepository.setCompensating).toHaveBeenCalled();
      expect(fromWallet.deposit).toHaveBeenCalledWith(200); // Refund
    });

    it('should handle critical failure when compensation also fails', async () => {
      const fromWallet = createMockWallet('wallet-a', 500);

      walletRepository.findById
        .mockResolvedValueOnce(fromWallet) // debit source - success
        .mockRejectedValueOnce(new Error('Destination DB failed')) // credit - FAILS
        .mockRejectedValueOnce(new Error('Compensation DB failed')); // compensation - ALSO FAILS

      const result = await service.execute('wallet-a', 'wallet-b', 200);

      expect(result.success).toBe(false);
      expect(result.message).toContain('CRITICAL');
      expect(result.message).toContain('Manual intervention required');
      expect(result.error).toContain('Compensation error');
    });
  });

  describe('Debit Failure (no compensation needed)', () => {
    it('should fail immediately if source wallet has insufficient funds', async () => {
      const fromWallet = createMockWallet('wallet-a', 50); // Only 50, trying to transfer 200

      walletRepository.findById.mockResolvedValueOnce(fromWallet);

      const result = await service.execute('wallet-a', 'wallet-b', 200);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unable to debit source wallet');

      // No compensation should be triggered (nothing to compensate)
      expect(sagaRepository.setCompensating).not.toHaveBeenCalled();
      expect(eventPublisher.publishCompensationInitiated).not.toHaveBeenCalled();
    });

    it('should fail immediately if source wallet not found', async () => {
      walletRepository.findById.mockRejectedValueOnce(new Error('Wallet not found'));

      const result = await service.execute('wallet-a', 'wallet-b', 200);

      expect(result.success).toBe(false);
      expect(sagaRepository.setCompensating).not.toHaveBeenCalled();
    });
  });

  describe('Saga State Transitions', () => {
    it('should track correct saga states on successful transfer', async () => {
      const fromWallet = createMockWallet('wallet-a', 500);
      const toWallet = createMockWallet('wallet-b', 100);

      walletRepository.findById
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet);

      await service.execute('wallet-a', 'wallet-b', 200);

      // Verify state transitions
      expect(sagaRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromWalletId: 'wallet-a',
          toWalletId: 'wallet-b',
          amount: 200,
        }),
      );
      expect(sagaRepository.setSourceDebited).toHaveBeenCalled();
      expect(sagaRepository.setCompleted).toHaveBeenCalled();
    });

    it('should track correct saga states on compensation', async () => {
      const fromWallet = createMockWallet('wallet-a', 500);

      walletRepository.findById
        .mockResolvedValueOnce(fromWallet)
        .mockRejectedValueOnce(new Error('Credit failed'))
        .mockResolvedValueOnce(fromWallet);

      await service.execute('wallet-a', 'wallet-b', 200);

      // Verify state transitions for compensation flow
      expect(sagaRepository.create).toHaveBeenCalled();
      expect(sagaRepository.setSourceDebited).toHaveBeenCalled();
      expect(sagaRepository.setCompensating).toHaveBeenCalled();
      expect(sagaRepository.setFailed).toHaveBeenCalled();
    });
  });

  describe('Event Publishing', () => {
    it('should publish all events on successful transfer', async () => {
      const fromWallet = createMockWallet('wallet-a', 500);
      const toWallet = createMockWallet('wallet-b', 100);

      walletRepository.findById
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet);

      await service.execute('wallet-a', 'wallet-b', 200);

      expect(eventPublisher.publishTransferInitiated).toHaveBeenCalled();
      expect(eventPublisher.publishSourceWalletDebited).toHaveBeenCalled();
      expect(eventPublisher.publishDestinationWalletCredited).toHaveBeenCalled();
      expect(eventPublisher.publishTransferCompleted).toHaveBeenCalled();
    });

    it('should publish compensation events when credit fails', async () => {
      const fromWallet = createMockWallet('wallet-a', 500);

      walletRepository.findById
        .mockResolvedValueOnce(fromWallet)
        .mockRejectedValueOnce(new Error('Credit failed'))
        .mockResolvedValueOnce(fromWallet);

      await service.execute('wallet-a', 'wallet-b', 200);

      expect(eventPublisher.publishTransferInitiated).toHaveBeenCalled();
      expect(eventPublisher.publishSourceWalletDebited).toHaveBeenCalled();
      expect(eventPublisher.publishCompensationInitiated).toHaveBeenCalled();
      expect(eventPublisher.publishSourceWalletRefunded).toHaveBeenCalled();
      expect(eventPublisher.publishTransferFailed).toHaveBeenCalled();

      // Should NOT publish success events
      expect(eventPublisher.publishDestinationWalletCredited).not.toHaveBeenCalled();
      expect(eventPublisher.publishTransferCompleted).not.toHaveBeenCalled();
    });
  });
});

