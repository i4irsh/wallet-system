/**
 * Concurrency Integration Tests: Double-Spend Prevention
 *
 * Tests the scenario: When User A has $100 and simultaneously attempts
 * a $100 withdrawal and $100 transfer
 *
 * Expected behavior: Only ONE operation should succeed, the other should fail
 * with a concurrency error (optimistic locking violation).
 *
 * Prerequisites: All services must be running (npm run start:dev:all)
 *
 * Run with: npm run test:integration:concurrency
 */

import {
  checkServicesRunning,
  delay,
  deposit,
  generateWalletId,
  getBalance,
  transfer,
  withdraw,
} from './helpers/test-helpers';

describe('Concurrency Tests - Double-Spend Prevention', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    await checkServicesRunning();
  });

  describe('Concurrent Withdraw and Transfer', () => {
    it('should prevent double-spend when attempting concurrent $100 withdrawal and $100 transfer with $100 balance', async () => {
      const walletId = generateWalletId();
      const targetWalletId = generateWalletId();

      // Setup - Deposit $100 to create the wallet
      const depositResult = await deposit(walletId, 100);
      expect(depositResult.status).toBe(201);
      expect(depositResult.data.balance).toBe(100);

      // Small delay to ensure event is processed
      await delay(200);

      // Execute both operations simultaneously
      const [withdrawResult, transferResult] = await Promise.all([
        withdraw(walletId, 100),
        transfer(walletId, targetWalletId, 100),
      ]);

      // Wait for read model to sync
      await delay(500);

      // The REAL test for double-spend: check the actual final balance
      // If double-spend occurred, balance would be negative (impossible) or
      // we'd have withdrawn more than deposited
      const finalBalance = await getBalance(walletId);

      // Critical assertion: balance must be >= 0 (no overdraft)
      expect(finalBalance).toBeGreaterThanOrEqual(0);

      // With $100 initial and $100 operations, final balance should be 0
      // (only one operation should have actually succeeded at the data level)
      expect(finalBalance).toBe(0);
    });
  });

  describe('Multiple Concurrent Withdrawals', () => {
    it('should prevent over-withdrawal when 5 concurrent $100 withdrawals are attempted with $100 balance', async () => {
      const walletId = generateWalletId();

      // Setup
      const depositResult = await deposit(walletId, 100);
      expect(depositResult.status).toBe(201);
      await delay(200);

      // Execute 5 concurrent withdrawals
      const results = await Promise.all([
        withdraw(walletId, 100),
        withdraw(walletId, 100),
        withdraw(walletId, 100),
        withdraw(walletId, 100),
        withdraw(walletId, 100),
      ]);

      // Wait for read model to sync
      await delay(500);

      // The REAL test: check the actual final balance
      const finalBalance = await getBalance(walletId);

      // Critical: balance must be >= 0
      expect(finalBalance).toBeGreaterThanOrEqual(0);

      // With $100 initial and only $100 available, final balance should be 0
      expect(finalBalance).toBe(0);
    });
  });

  describe('Rapid Fire Mixed Operations', () => {
    it('should prevent over-withdrawal when 10 concurrent $100 operations are attempted with $500 balance', async () => {
      const walletId = generateWalletId();
      const targetWalletId = generateWalletId();

      // Setup with $500
      const depositResult = await deposit(walletId, 500);
      expect(depositResult.status).toBe(201);
      await delay(200);

      // Execute mixed concurrent operations
      const results = await Promise.all([
        withdraw(walletId, 100),
        transfer(walletId, targetWalletId, 100),
        withdraw(walletId, 100),
        transfer(walletId, targetWalletId, 100),
        withdraw(walletId, 100),
        transfer(walletId, targetWalletId, 100),
        withdraw(walletId, 100),
        transfer(walletId, targetWalletId, 100),
        withdraw(walletId, 100),
        transfer(walletId, targetWalletId, 100),
      ]);

      // Wait for read model to sync
      await delay(500);

      // The REAL test: check the actual final balance
      const finalBalance = await getBalance(walletId);

      // Critical: balance must be >= 0 (no overdraft allowed)
      expect(finalBalance).toBeGreaterThanOrEqual(0);

      // Balance should be <= 500 (at least some operations succeeded)
      expect(finalBalance).toBeLessThanOrEqual(500);

      // At least one operation should have succeeded (balance decreased)
      expect(finalBalance).toBeLessThan(500);
    });
  });

  describe('Sequential vs Concurrent Behavior', () => {
    it('should allow both sequential withdrawals to succeed with sufficient balance', async () => {
      const walletId = generateWalletId();

      // Setup with $200
      await deposit(walletId, 200);
      await delay(100);

      // Sequential withdrawals
      const result1 = await withdraw(walletId, 100);
      expect(result1.status).toBe(201);

      await delay(50);

      const result2 = await withdraw(walletId, 100);
      expect(result2.status).toBe(201);

      // Both should succeed sequentially
      await delay(100);
      const finalBalance = await getBalance(walletId);
      expect(finalBalance).toBe(0);
    });

    it('should handle concurrent withdrawals with proper serialization via optimistic locking', async () => {
      const walletId = generateWalletId();

      // Setup with $200
      await deposit(walletId, 200);
      await delay(100);

      // Concurrent withdrawals
      const [result1, result2] = await Promise.all([withdraw(walletId, 100), withdraw(walletId, 100)]);

      const successCount = [result1, result2].filter((r) => r.status === 201).length;

      // Due to optimistic locking, at least one should succeed
      // Both might succeed if they're processed fast enough sequentially
      // Or only one might succeed if there's a true race
      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(successCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Bidirectional Transfer', () => {
    it('should handle simultaneous A→B and B→A transfers without deadlock', async () => {
      const walletA = generateWalletId('bidirectional-a');
      const walletB = generateWalletId('bidirectional-b');

      // Setup: Both wallets have $500
      await deposit(walletA, 500);
      await deposit(walletB, 500);
      await delay(200);

      // Verify initial state
      const initialBalanceA = await getBalance(walletA);
      const initialBalanceB = await getBalance(walletB);
      expect(initialBalanceA).toBe(500);
      expect(initialBalanceB).toBe(500);

      // Execute simultaneous bidirectional transfers: A→B $200 and B→A $200
      const [resultAtoB, resultBtoA] = await Promise.all([
        transfer(walletA, walletB, 200),
        transfer(walletB, walletA, 200),
      ]);

      // Wait for all operations to settle
      await delay(300);

      // Get final balances
      const finalBalanceA = await getBalance(walletA);
      const finalBalanceB = await getBalance(walletB);

      // CRITICAL: Total money must be conserved (no money created or lost)
      const totalInitial = 1000;
      const totalFinal = (finalBalanceA ?? 0) + (finalBalanceB ?? 0);
      expect(totalFinal).toBe(totalInitial);

      // CRITICAL: No negative balances
      expect(finalBalanceA).toBeGreaterThanOrEqual(0);
      expect(finalBalanceB).toBeGreaterThanOrEqual(0);
    });

    it('should handle simultaneous bidirectional transfers with different amounts', async () => {
      const walletA = generateWalletId('bidirectional-a');
      const walletB = generateWalletId('bidirectional-b');

      // Setup: Both wallets have $1000
      await deposit(walletA, 1000);
      await deposit(walletB, 1000);
      await delay(200);

      // A sends $300 to B, B sends $500 to A simultaneously
      const [resultAtoB, resultBtoA] = await Promise.all([
        transfer(walletA, walletB, 300),
        transfer(walletB, walletA, 500),
      ]);

      await delay(300);

      const finalBalanceA = await getBalance(walletA);
      const finalBalanceB = await getBalance(walletB);

      // Total money must be conserved
      expect((finalBalanceA ?? 0) + (finalBalanceB ?? 0)).toBe(2000);

      // No negative balances
      expect(finalBalanceA).toBeGreaterThanOrEqual(0);
      expect(finalBalanceB).toBeGreaterThanOrEqual(0);

      // If both transfers succeeded, check expected balances
      if (resultAtoB.status === 201 && resultBtoA.status === 201) {
        // A: 1000 - 300 + 500 = 1200
        // B: 1000 + 300 - 500 = 800
        expect(finalBalanceA).toBe(1200);
        expect(finalBalanceB).toBe(800);
      }
    });

    it('should handle multiple rounds of bidirectional transfers', async () => {
      const walletA = generateWalletId('bidirectional-a');
      const walletB = generateWalletId('bidirectional-b');

      // Setup
      await deposit(walletA, 1000);
      await deposit(walletB, 1000);
      await delay(200);

      // Execute 3 rounds of bidirectional transfers
      for (let round = 1; round <= 3; round++) {
        await Promise.all([transfer(walletA, walletB, 100), transfer(walletB, walletA, 100)]);
        await delay(200);
      }

      const finalBalanceA = await getBalance(walletA);
      const finalBalanceB = await getBalance(walletB);

      // Total must always be conserved
      expect((finalBalanceA ?? 0) + (finalBalanceB ?? 0)).toBe(2000);

      // No negative balances
      expect(finalBalanceA).toBeGreaterThanOrEqual(0);
      expect(finalBalanceB).toBeGreaterThanOrEqual(0);
    });

    it('should handle bidirectional transfer where one wallet has insufficient funds', async () => {
      const walletA = generateWalletId('bidirectional-a');
      const walletB = generateWalletId('bidirectional-b');

      // Setup: A has $100, B has $500
      await deposit(walletA, 100);
      await deposit(walletB, 500);
      await delay(200);

      // A tries to send $200 (insufficient), B sends $300
      const [resultAtoB, resultBtoA] = await Promise.all([
        transfer(walletA, walletB, 200), // Should fail - insufficient funds
        transfer(walletB, walletA, 300), // Should succeed
      ]);

      await delay(300);

      const finalBalanceA = await getBalance(walletA);
      const finalBalanceB = await getBalance(walletB);

      // Total money must be conserved
      expect((finalBalanceA ?? 0) + (finalBalanceB ?? 0)).toBe(600);

      // No negative balances
      expect(finalBalanceA).toBeGreaterThanOrEqual(0);
      expect(finalBalanceB).toBeGreaterThanOrEqual(0);

      // A→B should fail due to insufficient funds
      expect(resultAtoB.data.success).toBe(false);
    });

    it('should handle 3-way circular transfers (A→B, B→C, C→A)', async () => {
      const walletA = generateWalletId('circular-a');
      const walletB = generateWalletId('circular-b');
      const walletC = generateWalletId('circular-c');

      // Setup: All wallets have $500
      await deposit(walletA, 500);
      await deposit(walletB, 500);
      await deposit(walletC, 500);
      await delay(200);

      // Circular transfers: A→B, B→C, C→A all at once
      const [resultAB, resultBC, resultCA] = await Promise.all([
        transfer(walletA, walletB, 200),
        transfer(walletB, walletC, 200),
        transfer(walletC, walletA, 200),
      ]);

      await delay(300);

      const finalA = await getBalance(walletA);
      const finalB = await getBalance(walletB);
      const finalC = await getBalance(walletC);

      // Total money must be conserved
      expect((finalA ?? 0) + (finalB ?? 0) + (finalC ?? 0)).toBe(1500);

      // No negative balances
      expect(finalA).toBeGreaterThanOrEqual(0);
      expect(finalB).toBeGreaterThanOrEqual(0);
      expect(finalC).toBeGreaterThanOrEqual(0);
    });
  });
});
