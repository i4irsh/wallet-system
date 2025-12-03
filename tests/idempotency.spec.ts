/**
 * Idempotency Integration Tests
 *
 * Tests the idempotency feature for preventing duplicate requests
 *
 * Prerequisites: All services must be running (npm run start:dev:all)
 *
 * Run with: npm run test:integration:idempotency
 */

import {
  ApiResponse,
  BASE_URL,
  checkServicesRunning,
  delay,
  generateIdempotencyKey,
  generateWalletId,
  IDEMPOTENCY_HEADER,
  makeRequestWithoutIdempotency,
} from './helpers/test-helpers';

describe('Idempotency Tests', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    await checkServicesRunning();
  });

  describe('Missing Idempotency Key', () => {
    it('should return 400 Bad Request when idempotency key is missing on deposit', async () => {
      const result = await makeRequestWithoutIdempotency('/deposit', {
        walletId: generateWalletId(),
        amount: 100,
      });

      expect(result.status).toBe(400);
      expect(result.data.message).toContain('x-idempotency-key');
    });

    it('should return 400 Bad Request when idempotency key is missing on withdraw', async () => {
      const result = await makeRequestWithoutIdempotency('/withdraw', {
        walletId: generateWalletId(),
        amount: 50,
      });

      expect(result.status).toBe(400);
      expect(result.data.message).toContain('x-idempotency-key');
    });

    it('should return 400 Bad Request when idempotency key is missing on transfer', async () => {
      const result = await makeRequestWithoutIdempotency('/transfer', {
        fromWalletId: generateWalletId(),
        toWalletId: generateWalletId(),
        amount: 50,
      });

      expect(result.status).toBe(400);
      expect(result.data.message).toContain('x-idempotency-key');
    });
  });

  describe('Valid Request With Idempotency Key', () => {
    it('should succeed when a valid request includes an idempotency key', async () => {
      const walletId = generateWalletId();
      const idempotencyKey = generateIdempotencyKey();

      const response = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
        body: JSON.stringify({ walletId, amount: 100 }),
      });

      expect([200, 201]).toContain(response.status);
      const result: ApiResponse = await response.json();
      expect(result.success).toBe(true);
      expect(result.balance).toBe(100);
    });
  });

  describe('Duplicate Request Handling', () => {
    it('should return cached response for duplicate request with same idempotency key', async () => {
      const walletId = generateWalletId();
      const idempotencyKey = generateIdempotencyKey();

      // First request
      const firstResponse = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
        body: JSON.stringify({ walletId, amount: 100 }),
      });

      const firstResult: ApiResponse = await firstResponse.json();
      expect(firstResult.balance).toBe(100);

      // Wait for response to be stored
      await delay(100);

      // Duplicate request with same idempotency key
      const duplicateResponse = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
        body: JSON.stringify({ walletId, amount: 100 }),
      });

      const duplicateResult: ApiResponse = await duplicateResponse.json();
      expect(duplicateResult._cached).toBe(true);
      expect(duplicateResult._idempotencyKey).toBe(idempotencyKey);
    });

    it('should process requests independently with different idempotency keys', async () => {
      const walletId = generateWalletId();
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();

      // First deposit with key1
      const response1 = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: key1,
        },
        body: JSON.stringify({ walletId, amount: 100 }),
      });

      const result1: ApiResponse = await response1.json();
      expect(result1.balance).toBe(100);

      // Wait for processing
      await delay(100);

      // Second deposit with key2 - should actually process and add more
      const response2 = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: key2,
        },
        body: JSON.stringify({ walletId, amount: 50 }),
      });

      const result2: ApiResponse = await response2.json();
      expect(result2.balance).toBe(150);
      expect(result2._cached).toBeFalsy();
    });
  });

  describe('Double Operation Prevention', () => {
    it('should prevent double withdraw with same idempotency key', async () => {
      const walletId = generateWalletId();
      const depositKey = generateIdempotencyKey();
      const withdrawKey = generateIdempotencyKey();

      // Setup: deposit 100
      await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: depositKey,
        },
        body: JSON.stringify({ walletId, amount: 100 }),
      });

      await delay(100);

      // First withdraw of 60
      const response1 = await fetch(`${BASE_URL}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: withdrawKey,
        },
        body: JSON.stringify({ walletId, amount: 60 }),
      });

      const result1: ApiResponse = await response1.json();
      expect(result1.balance).toBe(40);

      await delay(100);

      // Duplicate withdraw with same key - should return cached, not withdraw again
      const response2 = await fetch(`${BASE_URL}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: withdrawKey,
        },
        body: JSON.stringify({ walletId, amount: 60 }),
      });

      const result2: ApiResponse = await response2.json();
      expect(result2._cached).toBe(true);
      expect(result2.balance).toBe(40); // Balance unchanged
    });

    it('should prevent double transfer with same idempotency key', async () => {
      const fromWalletId = generateWalletId();
      const toWalletId = generateWalletId();
      const depositKey1 = generateIdempotencyKey();
      const depositKey2 = generateIdempotencyKey();
      const transferKey = generateIdempotencyKey();

      // Setup: fund both wallets
      await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: depositKey1,
        },
        body: JSON.stringify({ walletId: fromWalletId, amount: 500 }),
      });

      await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: depositKey2,
        },
        body: JSON.stringify({ walletId: toWalletId, amount: 100 }),
      });

      await delay(200);

      // First transfer
      const transfer1Response = await fetch(`${BASE_URL}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: transferKey,
        },
        body: JSON.stringify({ fromWalletId, toWalletId, amount: 200 }),
      });

      const transfer1Result: ApiResponse = await transfer1Response.json();
      expect(transfer1Result.success).toBe(true);

      await delay(100);

      // Duplicate transfer with same key
      const transfer2Response = await fetch(`${BASE_URL}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: transferKey,
        },
        body: JSON.stringify({ fromWalletId, toWalletId, amount: 200 }),
      });

      const transfer2Result: ApiResponse = await transfer2Response.json();
      expect(transfer2Result._cached).toBe(true);
      expect(transfer2Result.fromBalance).toBe(300);
      expect(transfer2Result.toBalance).toBe(300);
    });
  });

  describe('GET Endpoints', () => {
    it('should not require idempotency key for GET balance endpoint', async () => {
      const walletId = generateWalletId();
      const depositKey = generateIdempotencyKey();

      // Setup: create a wallet
      await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: depositKey,
        },
        body: JSON.stringify({ walletId, amount: 100 }),
      });

      await delay(200);

      // GET balance without idempotency key - should work
      const balanceResponse = await fetch(`${BASE_URL}/balance/${walletId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(balanceResponse.status).toBe(200);
    });

    it('should not require idempotency key for GET transactions endpoint', async () => {
      const walletId = generateWalletId();
      const depositKey = generateIdempotencyKey();

      // Setup: create a wallet
      await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: depositKey,
        },
        body: JSON.stringify({ walletId, amount: 100 }),
      });

      await delay(200);

      // GET transactions without idempotency key - should work
      const transactionsResponse = await fetch(`${BASE_URL}/transactions/${walletId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(transactionsResponse.status).toBe(200);
    });
  });

  describe('Cross-Endpoint Idempotency', () => {
    it('should return cached response when same idempotency key is used on different endpoints', async () => {
      const sharedKey = generateIdempotencyKey();
      const walletId1 = generateWalletId();
      const walletId2 = generateWalletId();

      // Use same key for deposit on wallet1
      const depositResponse = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: sharedKey,
        },
        body: JSON.stringify({ walletId: walletId1, amount: 100 }),
      });

      await depositResponse.json();
      await delay(100);

      // Use same key for withdraw on wallet2 - should return cached deposit response
      const withdrawResponse = await fetch(`${BASE_URL}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: sharedKey,
        },
        body: JSON.stringify({ walletId: walletId2, amount: 50 }),
      });

      const withdrawResult: ApiResponse = await withdrawResponse.json();
      expect(withdrawResult._cached).toBe(true);
    });
  });

  describe('Rapid Duplicate Requests', () => {
    it('should handle rapid duplicate requests correctly', async () => {
      const walletId = generateWalletId();
      const idempotencyKey = generateIdempotencyKey();

      // Fire 5 requests simultaneously with same idempotency key
      const requests = Array.from({ length: 5 }, () =>
        fetch(`${BASE_URL}/deposit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [IDEMPOTENCY_HEADER]: idempotencyKey,
          },
          body: JSON.stringify({ walletId, amount: 100 }),
        }).then((res) => res.json()),
      );

      const results: ApiResponse[] = await Promise.all(requests);

      // Count successful (non-cached, non-conflict) responses
      const successfulProcessed = results.filter((r) => !r._cached && r.statusCode !== 409);
      const cachedResponses = results.filter((r) => r._cached === true);
      const conflictResponses = results.filter((r) => r.statusCode === 409);

      // Should have exactly 1 processed + rest either cached or conflict
      expect(successfulProcessed.length).toBe(1);
      expect(cachedResponses.length + conflictResponses.length).toBe(4);

      // Verify the final balance is only 100 (not 500)
      await delay(200);
      const balanceResponse = await fetch(`${BASE_URL}/balance/${walletId}`);
      const balanceResult = await balanceResponse.json();
      expect(balanceResult.balance).toBe(100);
    });
  });

  describe('Cached Response Data Preservation', () => {
    it('should preserve original response data when returning cached response', async () => {
      const walletId = generateWalletId();
      const idempotencyKey = generateIdempotencyKey();

      // First request with amount 250
      const firstResponse = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
        body: JSON.stringify({ walletId, amount: 250 }),
      });

      await firstResponse.json();
      await delay(100);

      // Second request with DIFFERENT amount but same key - should return original amount
      const secondResponse = await fetch(`${BASE_URL}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
        body: JSON.stringify({ walletId, amount: 999 }), // Different amount!
      });

      const secondResult: ApiResponse = await secondResponse.json();
      // Should return cached response with original balance (250), not the new amount
      expect(secondResult._cached).toBe(true);
      expect(secondResult.balance).toBe(250);
    });
  });
});
