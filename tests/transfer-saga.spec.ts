/**
 * Transfer Saga Integration Tests
 *
 * Tests the transfer saga pattern for atomic multi-wallet transfers
 *
 * Prerequisites: All services must be running (npm run start:dev:all)
 *
 * Run with: npm run test:integration:saga
 */

import {
  checkServicesRunning,
  delay,
  deposit,
  generateIdempotencyKey,
  generateWalletId,
  getBalance,
  RequestResult,
  transfer,
} from './helpers/test-helpers';

describe('Transfer Saga Tests', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    await checkServicesRunning();
  });

  describe('Happy Path', () => {
    it('should complete transfer successfully with sufficient balance', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');

      // Setup: Create both wallets
      await deposit(fromWalletId, 500);
      await deposit(toWalletId, 100);
      await delay(100);

      // Execute transfer
      const result = await transfer(fromWalletId, toWalletId, 200);

      expect(result.status).toBe(201);
      expect(result.data.success).toBe(true);
      expect(result.data.fromBalance).toBe(300);
      expect(result.data.toBalance).toBe(300);
    });

    it('should update both wallet balances atomically', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');

      // Setup
      await deposit(fromWalletId, 1000);
      await deposit(toWalletId, 500);
      await delay(200);

      // Execute transfer
      await transfer(fromWalletId, toWalletId, 300);
      await delay(200);

      // Verify balances via read model
      const fromBalance = await getBalance(fromWalletId);
      const toBalance = await getBalance(toWalletId);

      expect(fromBalance).toBe(700);
      expect(toBalance).toBe(800);
    });

    it('should handle transfer to non-existent wallet (creates it)', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to'); // This wallet doesn't exist yet

      // Setup: Only create source wallet
      await deposit(fromWalletId, 500);
      await delay(100);

      // Execute transfer to non-existent wallet
      const result = await transfer(fromWalletId, toWalletId, 200);

      expect(result.status).toBe(201);
      expect(result.data.success).toBe(true);
      expect(result.data.fromBalance).toBe(300);
      expect(result.data.toBalance).toBe(200);
    });
  });

  describe('Insufficient Funds', () => {
    it('should fail transfer when source wallet has insufficient funds', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');

      // Setup: Create wallet with only $50
      await deposit(fromWalletId, 50);
      await delay(100);

      // Attempt transfer of $100 (should fail)
      const result = await transfer(fromWalletId, toWalletId, 100);

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('Insufficient');
    });

    it('should not modify destination wallet when transfer fails', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');

      // Setup
      await deposit(fromWalletId, 50);
      await deposit(toWalletId, 200);
      await delay(200);

      // Attempt transfer that should fail
      await transfer(fromWalletId, toWalletId, 100);
      await delay(200);

      // Verify destination wallet balance unchanged
      const toBalance = await getBalance(toWalletId);
      expect(toBalance).toBe(200);
    });
  });

  describe('Self Transfer', () => {
    it('should handle self-transfer gracefully', async () => {
      const walletId = generateWalletId('saga-self');

      // Setup
      await deposit(walletId, 500);
      await delay(100);

      // Attempt self-transfer
      const result = await transfer(walletId, walletId, 100);

      // Self-transfer is processed as withdraw + deposit to same wallet
      // The balance should remain unchanged (500) after both operations complete
      await delay(200);
      const finalBalance = await getBalance(walletId);

      // Verify no money was lost or created
      expect(finalBalance).toBe(500);
    });
  });

  describe('Multiple Transfers', () => {
    it('should handle sequential transfers correctly', async () => {
      const walletA = generateWalletId('saga-a');
      const walletB = generateWalletId('saga-b');
      const walletC = generateWalletId('saga-c');

      // Setup
      await deposit(walletA, 1000);
      await deposit(walletB, 500);
      await deposit(walletC, 200);
      await delay(200);

      // Sequential transfers: A -> B -> C
      const result1 = await transfer(walletA, walletB, 300);
      await delay(100);
      expect(result1.data.success).toBe(true);

      const result2 = await transfer(walletB, walletC, 400);
      await delay(100);
      expect(result2.data.success).toBe(true);

      // Verify final balances
      await delay(200);
      const balanceA = await getBalance(walletA);
      const balanceB = await getBalance(walletB);
      const balanceC = await getBalance(walletC);

      expect(balanceA).toBe(700); // 1000 - 300
      expect(balanceB).toBe(400); // 500 + 300 - 400
      expect(balanceC).toBe(600); // 200 + 400
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount transfer', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');

      // Setup
      await deposit(fromWalletId, 500);
      await delay(100);

      // Attempt zero amount transfer
      const result = await transfer(fromWalletId, toWalletId, 0);

      // Note: Current system accepts zero amount transfers
      // This documents actual behavior - validation could be added later
      if (result.status === 201) {
        // Zero transfer should not change balance
        await delay(100);
        const fromBalance = await getBalance(fromWalletId);
        expect(fromBalance).toBe(500);
      } else {
        // If validation is added, expect 400 Bad Request
        expect(result.status).toBe(400);
      }
    });

    it('should handle negative amount transfer', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');

      // Setup
      await deposit(fromWalletId, 500);
      await delay(100);

      // Attempt negative amount transfer
      const result = await transfer(fromWalletId, toWalletId, -100);

      // Note: Current system accepts negative amount transfers
      // This documents actual behavior - validation could be added later
      if (result.status === 201) {
        // Negative transfer would effectively be a reverse transfer
        // Document what actually happens
        await delay(100);
        const fromBalance = await getBalance(fromWalletId);
        // Balance should have increased (negative withdrawal = deposit)
        expect(fromBalance).toBeGreaterThanOrEqual(500);
      } else {
        // If validation is added, expect 400 Bad Request
        expect(result.status).toBe(400);
      }
    });

    it('should handle very large transfer amount', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');

      // Setup with large amount
      await deposit(fromWalletId, 1000000);
      await delay(100);

      // Transfer large amount
      const result = await transfer(fromWalletId, toWalletId, 999999);

      expect(result.status).toBe(201);
      expect(result.data.success).toBe(true);
      expect(result.data.fromBalance).toBe(1);
      expect(result.data.toBalance).toBe(999999);
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate transfer requests with same idempotency key', async () => {
      const fromWalletId = generateWalletId('saga-from');
      const toWalletId = generateWalletId('saga-to');
      const idempotencyKey = generateIdempotencyKey('saga-transfer');

      // Setup
      await deposit(fromWalletId, 500);
      await deposit(toWalletId, 100);
      await delay(200);

      // First transfer
      const result1 = await transfer(fromWalletId, toWalletId, 200, idempotencyKey);
      expect(result1.data.success).toBe(true);
      expect(result1.data.fromBalance).toBe(300);
      expect(result1.data.toBalance).toBe(300);

      await delay(100);

      // Duplicate transfer with same key
      const result2 = await transfer(fromWalletId, toWalletId, 200, idempotencyKey);

      // Should return cached response
      expect(result2.data.fromBalance).toBe(300);
      expect(result2.data.toBalance).toBe(300);

      // Verify actual balance hasn't changed
      await delay(100);
      const actualFromBalance = await getBalance(fromWalletId);
      expect(actualFromBalance).toBe(300);
    });
  });

  describe('Rollback and Compensation', () => {
    it('should restore source wallet balance when transfer fails due to insufficient funds', async () => {
      const fromWalletId = generateWalletId('rollback-from');
      const toWalletId = generateWalletId('rollback-to');

      // Setup: Source has $100
      await deposit(fromWalletId, 100);
      await delay(200);

      const initialBalance = await getBalance(fromWalletId);
      expect(initialBalance).toBe(100);

      // Attempt transfer that exceeds balance
      const result = await transfer(fromWalletId, toWalletId, 500);
      await delay(200);

      // Verify failure
      expect(result.data.success).toBe(false);

      // CRITICAL: Source wallet balance must be unchanged (rollback/compensation worked)
      const finalBalance = await getBalance(fromWalletId);
      expect(finalBalance).toBe(100);
    });

    it('should preserve money conservation after failed transfer', async () => {
      const fromWalletId = generateWalletId('rollback-from');
      const toWalletId = generateWalletId('rollback-to');

      // Setup: Both wallets have known balances
      await deposit(fromWalletId, 300);
      await deposit(toWalletId, 200);
      await delay(200);

      const totalBefore = 500; // 300 + 200

      // Attempt transfer that will fail (source doesn't have enough)
      await transfer(fromWalletId, toWalletId, 400);
      await delay(200);

      // Verify total money is unchanged
      const fromBalance = await getBalance(fromWalletId);
      const toBalance = await getBalance(toWalletId);
      const totalAfter = (fromBalance ?? 0) + (toBalance ?? 0);

      expect(totalAfter).toBe(totalBefore);
    });

    it('should handle multiple failed transfers without corrupting state', async () => {
      const fromWalletId = generateWalletId('rollback-from');
      const toWalletId = generateWalletId('rollback-to');

      // Setup
      await deposit(fromWalletId, 100);
      await delay(200);

      // Attempt multiple failed transfers
      for (let i = 0; i < 5; i++) {
        const result = await transfer(fromWalletId, toWalletId, 500);
        expect(result.data.success).toBe(false);
        await delay(50);
      }

      await delay(200);

      // Balance should still be exactly 100 after all failed attempts
      const finalBalance = await getBalance(fromWalletId);
      expect(finalBalance).toBe(100);
    });

    it('should handle interleaved successful and failed transfers correctly', async () => {
      const fromWalletId = generateWalletId('rollback-from');
      const toWalletId = generateWalletId('rollback-to');

      // Setup: Source has $500
      await deposit(fromWalletId, 500);
      await delay(200);

      // Successful transfer: $100
      const result1 = await transfer(fromWalletId, toWalletId, 100);
      expect(result1.data.success).toBe(true);
      await delay(100);

      // Failed transfer: $600 (source only has $400 now)
      const result2 = await transfer(fromWalletId, toWalletId, 600);
      expect(result2.data.success).toBe(false);
      await delay(100);

      // Successful transfer: $200
      const result3 = await transfer(fromWalletId, toWalletId, 200);
      expect(result3.data.success).toBe(true);
      await delay(100);

      // Failed transfer: $300 (source only has $200 now)
      const result4 = await transfer(fromWalletId, toWalletId, 300);
      expect(result4.data.success).toBe(false);
      await delay(200);

      // Verify final balances
      const fromBalance = await getBalance(fromWalletId);
      const toBalance = await getBalance(toWalletId);

      // Source: 500 - 100 - 200 = 200
      expect(fromBalance).toBe(200);
      // Destination: 0 + 100 + 200 = 300
      expect(toBalance).toBe(300);
      // Total conserved
      expect((fromBalance ?? 0) + (toBalance ?? 0)).toBe(500);
    });

    it('should not leave partial state when transfer fails mid-operation', async () => {
      const fromWalletId = generateWalletId('rollback-from');
      const toWalletId = generateWalletId('rollback-to');

      // Setup
      await deposit(fromWalletId, 1000);
      await deposit(toWalletId, 500);
      await delay(200);

      const totalBefore = 1500;

      // Execute concurrent transfers where some may fail due to insufficient funds
      const transfers = await Promise.all([
        transfer(fromWalletId, toWalletId, 400),
        transfer(fromWalletId, toWalletId, 400),
        transfer(fromWalletId, toWalletId, 400),
      ]);

      await delay(300);

      const fromBalance = await getBalance(fromWalletId);
      const toBalance = await getBalance(toWalletId);
      const totalAfter = (fromBalance ?? 0) + (toBalance ?? 0);

      // CRITICAL: No money should be created or destroyed
      expect(totalAfter).toBe(totalBefore);

      // Source should never go negative
      expect(fromBalance).toBeGreaterThanOrEqual(0);

      // Count successes - at most 2 should succeed (2 * 400 = 800, leaving 200)
      const successCount = transfers.filter((r) => r.status === 201 && r.data.success).length;
      expect(successCount).toBeLessThanOrEqual(2);

      console.log(
        `Concurrent transfers: ${successCount}/3 succeeded, ` +
          `From: $${fromBalance}, To: $${toBalance}, Total: $${totalAfter}`,
      );
    });

    it('should handle compensation idempotently for failed transfers', async () => {
      const fromWalletId = generateWalletId('rollback-from');
      const toWalletId = generateWalletId('rollback-to');
      const idempotencyKey = generateIdempotencyKey('rollback-transfer');

      // Setup
      await deposit(fromWalletId, 100);
      await delay(200);

      // First attempt - should fail
      const result1 = await transfer(fromWalletId, toWalletId, 500, idempotencyKey);
      expect(result1.data.success).toBe(false);
      await delay(100);

      // Retry with same idempotency key - should return same failed result
      const result2 = await transfer(fromWalletId, toWalletId, 500, idempotencyKey);
      expect(result2.data.success).toBe(false);
      await delay(100);

      // Balance should still be 100
      const finalBalance = await getBalance(fromWalletId);
      expect(finalBalance).toBe(100);
    });

    it('should preserve atomicity - either both wallets change or neither does', async () => {
      const fromWalletId = generateWalletId('atomic-from');
      const toWalletId = generateWalletId('atomic-to');

      // Setup
      await deposit(fromWalletId, 500);
      await deposit(toWalletId, 200);
      await delay(200);

      // Record balances before
      const fromBefore = await getBalance(fromWalletId);
      const toBefore = await getBalance(toWalletId);

      // Execute transfer
      const result = await transfer(fromWalletId, toWalletId, 300);
      await delay(200);

      const fromAfter = await getBalance(fromWalletId);
      const toAfter = await getBalance(toWalletId);

      if (result.data.success) {
        // If successful, both should have changed
        expect(fromAfter).toBe((fromBefore ?? 0) - 300);
        expect(toAfter).toBe((toBefore ?? 0) + 300);
      } else {
        // If failed, neither should have changed
        expect(fromAfter).toBe(fromBefore);
        expect(toAfter).toBe(toBefore);
      }
    });

    it('should handle rapid sequential transfers with intermittent failures', async () => {
      const fromWalletId = generateWalletId('rapid-from');
      const toWalletId = generateWalletId('rapid-to');

      // Setup with enough for exactly 5 transfers of $100
      await deposit(fromWalletId, 500);
      await delay(200);

      // Execute 10 rapid transfers - first 5 should succeed, last 5 should fail
      const results: RequestResult[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await transfer(fromWalletId, toWalletId, 100);
        results.push(result);
        // Minimal delay to allow processing
        await delay(50);
      }

      await delay(300);

      const fromBalance = await getBalance(fromWalletId);
      const toBalance = await getBalance(toWalletId);

      // Should have transferred exactly $500 (all original funds)
      expect(fromBalance).toBe(0);
      expect(toBalance).toBe(500);

      // Count results
      const successCount = results.filter((r) => r.data.success).length;
      const failCount = results.filter((r) => !r.data.success).length;

      expect(successCount).toBe(5);
      expect(failCount).toBe(5);
    });
  });
});
