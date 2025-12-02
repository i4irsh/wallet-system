/**
 * Idempotency E2E Tests
 * 
 * Tests the idempotency feature for preventing duplicate requests
 * 
 * Run with: npx ts-node tests/idempotency.test.ts
 */

const BASE_URL = 'http://localhost:3000';
const IDEMPOTENCY_HEADER = 'x-idempotency-key';

function generateKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function generateWalletId(): string {
  return `wallet-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// ============================================================
// TEST 1: Missing idempotency key returns 400 Bad Request
// ============================================================
async function testMissingIdempotencyKey(): Promise<void> {
  console.log('\n=== TEST: Missing Idempotency Key Returns 400 ===');

  const response = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletId: generateWalletId(), amount: 100 }),
  });

  if (response.status === 400) {
    const result = await response.json();
    if (result.message?.includes('x-idempotency-key')) {
      console.log('✅ PASSED: Missing idempotency key correctly returns 400');
      return;
    }
  }

  console.log('❌ FAILED: Expected 400 status with proper error message');
  throw new Error('Missing idempotency key test failed');
}

// ============================================================
// TEST 2: Valid request with idempotency key succeeds
// ============================================================
async function testValidRequestWithIdempotencyKey(): Promise<void> {
  console.log('\n=== TEST: Valid Request With Idempotency Key Succeeds ===');

  const walletId = generateWalletId();
  const idempotencyKey = generateKey();

  const response = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify({ walletId, amount: 100 }),
  });

  if (response.status !== 200 && response.status !== 201) {
    const text = await response.text();
    console.log('Response:', response.status, text);
    throw new Error('Valid request with idempotency key should succeed');
  }

  const result = await response.json();

  if (result.success === true && result.balance === 100) {
    console.log('✅ PASSED: Request with idempotency key succeeded');
  } else {
    console.log('Result:', result);
    throw new Error('Unexpected response from valid idempotency request');
  }
}

// ============================================================
// TEST 3: Duplicate request returns cached response
// ============================================================
async function testDuplicateRequestReturnsCachedResponse(): Promise<void> {
  console.log('\n=== TEST: Duplicate Request Returns Cached Response ===');

  const walletId = generateWalletId();
  const idempotencyKey = generateKey();

  // First request
  const firstResponse = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify({ walletId, amount: 100 }),
  });

  const firstResult = await firstResponse.json();

  if (firstResult.balance !== 100) {
    throw new Error('First request should create wallet with balance 100');
  }

  // Wait for response to be stored
  await new Promise(r => setTimeout(r, 100));

  // Duplicate request with same idempotency key
  const duplicateResponse = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify({ walletId, amount: 100 }),
  });

  const duplicateResult = await duplicateResponse.json();

  if (duplicateResult._cached === true && duplicateResult._idempotencyKey === idempotencyKey) {
    console.log('✅ PASSED: Duplicate request returned cached response');
  } else {
    console.log('First result:', firstResult);
    console.log('Duplicate result:', duplicateResult);
    throw new Error('Duplicate request should return cached response with _cached flag');
  }
}

// ============================================================
// TEST 4: Different idempotency keys are independent
// ============================================================
async function testDifferentIdempotencyKeysAreIndependent(): Promise<void> {
  console.log('\n=== TEST: Different Idempotency Keys Are Independent ===');

  const walletId = generateWalletId();
  const key1 = generateKey();
  const key2 = generateKey();

  // First deposit with key1
  const response1 = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: key1,
    },
    body: JSON.stringify({ walletId, amount: 100 }),
  });

  const result1 = await response1.json();

  if (result1.balance !== 100) {
    throw new Error('First deposit should create wallet with balance 100');
  }

  // Wait for processing
  await new Promise(r => setTimeout(r, 100));

  // Second deposit with key2 - should actually process and add more
  const response2 = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: key2,
    },
    body: JSON.stringify({ walletId, amount: 50 }),
  });

  const result2 = await response2.json();

  if (result2.balance === 150 && !result2._cached) {
    console.log('✅ PASSED: Different idempotency keys processed independently');
  } else {
    console.log('Result 1:', result1);
    console.log('Result 2:', result2);
    throw new Error('Different idempotency keys should be processed independently');
  }
}

// ============================================================
// TEST 5: Idempotency prevents double-spend on withdraw
// ============================================================
async function testIdempotencyPreventsDoubleWithdraw(): Promise<void> {
  console.log('\n=== TEST: Idempotency Prevents Double Withdraw ===');

  const walletId = generateWalletId();
  const depositKey = generateKey();
  const withdrawKey = generateKey();

  // Setup: deposit 100
  await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: depositKey,
    },
    body: JSON.stringify({ walletId, amount: 100 }),
  });

  await new Promise(r => setTimeout(r, 100));

  // First withdraw of 60
  const response1 = await fetch(`${BASE_URL}/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: withdrawKey,
    },
    body: JSON.stringify({ walletId, amount: 60 }),
  });

  const result1 = await response1.json();

  if (result1.balance !== 40) {
    throw new Error(`First withdraw should leave balance of 40, got ${result1.balance}`);
  }

  await new Promise(r => setTimeout(r, 100));

  // Duplicate withdraw with same key - should return cached, not withdraw again
  const response2 = await fetch(`${BASE_URL}/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: withdrawKey,
    },
    body: JSON.stringify({ walletId, amount: 60 }),
  });

  const result2 = await response2.json();

  // Verify balance wasn't changed (duplicate was cached)
  if (result2._cached === true && result2.balance === 40) {
    console.log('✅ PASSED: Idempotency prevented double withdraw');
  } else {
    console.log('Result 1:', result1);
    console.log('Result 2:', result2);
    throw new Error('Duplicate withdraw should return cached response, not process again');
  }
}

// ============================================================
// TEST 6: GET endpoints don't require idempotency key
// ============================================================
async function testGetEndpointsDontRequireIdempotency(): Promise<void> {
  console.log('\n=== TEST: GET Endpoints Dont Require Idempotency Key ===');

  const walletId = generateWalletId();
  const depositKey = generateKey();

  // Setup: create a wallet
  await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: depositKey,
    },
    body: JSON.stringify({ walletId, amount: 100 }),
  });

  await new Promise(r => setTimeout(r, 200));

  // GET balance without idempotency key - should work
  const balanceResponse = await fetch(`${BASE_URL}/balance/${walletId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  // GET transactions without idempotency key - should work
  const transactionsResponse = await fetch(`${BASE_URL}/transactions/${walletId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (balanceResponse.status === 200 && transactionsResponse.status === 200) {
    console.log('✅ PASSED: GET endpoints work without idempotency key');
  } else {
    console.log('Balance status:', balanceResponse.status);
    console.log('Transactions status:', transactionsResponse.status);
    throw new Error('GET endpoints should not require idempotency key');
  }
}

// ============================================================
// TEST 7: Idempotency works across different endpoints
// ============================================================
async function testIdempotencyAcrossEndpoints(): Promise<void> {
  console.log('\n=== TEST: Same Idempotency Key On Different Endpoints ===');

  const sharedKey = generateKey();
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

  const depositResult = await depositResponse.json();

  await new Promise(r => setTimeout(r, 100));

  // Use same key for withdraw on wallet2 - should return cached deposit response
  // because idempotency is based on the key alone
  const withdrawResponse = await fetch(`${BASE_URL}/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: sharedKey,
    },
    body: JSON.stringify({ walletId: walletId2, amount: 50 }),
  });

  const withdrawResult = await withdrawResponse.json();

  // The withdraw should return the cached deposit response since key is shared
  if (withdrawResult._cached === true) {
    console.log('✅ PASSED: Same idempotency key returns cached response across endpoints');
  } else {
    console.log('Deposit result:', depositResult);
    console.log('Withdraw result:', withdrawResult);
    throw new Error('Same idempotency key should return cached response regardless of endpoint');
  }
}

// ============================================================
// TEST 8: Transfer with idempotency prevents duplicate transfers
// ============================================================
async function testIdempotencyPreventsDoubleTransfer(): Promise<void> {
  console.log('\n=== TEST: Idempotency Prevents Double Transfer ===');

  const fromWalletId = generateWalletId();
  const toWalletId = generateWalletId();
  const depositKey1 = generateKey();
  const depositKey2 = generateKey();
  const transferKey = generateKey();

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

  await new Promise(r => setTimeout(r, 200));

  // First transfer
  const transfer1Response = await fetch(`${BASE_URL}/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: transferKey,
    },
    body: JSON.stringify({ fromWalletId, toWalletId, amount: 200 }),
  });

  const transfer1Result = await transfer1Response.json();

  if (!transfer1Result.success) {
    console.log('Transfer 1 result:', transfer1Result);
    throw new Error('First transfer should succeed');
  }

  await new Promise(r => setTimeout(r, 100));

  // Duplicate transfer with same key
  const transfer2Response = await fetch(`${BASE_URL}/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: transferKey,
    },
    body: JSON.stringify({ fromWalletId, toWalletId, amount: 200 }),
  });

  const transfer2Result = await transfer2Response.json();

  if (transfer2Result._cached === true && transfer2Result.fromBalance === 300 && transfer2Result.toBalance === 300) {
    console.log('✅ PASSED: Idempotency prevented double transfer');
  } else {
    console.log('Transfer 1 result:', transfer1Result);
    console.log('Transfer 2 result:', transfer2Result);
    throw new Error('Duplicate transfer should return cached response');
  }
}

// ============================================================
// TEST 9: Multiple rapid requests with same key (idempotency under load)
// ============================================================
async function testRapidDuplicateRequests(): Promise<void> {
  console.log('\n=== TEST: Rapid Duplicate Requests ===');

  const walletId = generateWalletId();
  const idempotencyKey = generateKey();

  // Fire 5 requests simultaneously with same idempotency key
  const requests = Array.from({ length: 5 }, () =>
    fetch(`${BASE_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [IDEMPOTENCY_HEADER]: idempotencyKey,
      },
      body: JSON.stringify({ walletId, amount: 100 }),
    }).then(res => res.json())
  );

  const results = await Promise.all(requests);

  // Count successful (non-cached, non-conflict) responses
  const successfulProcessed = results.filter(r => !r._cached && r.statusCode !== 409);
  const cachedResponses = results.filter(r => r._cached === true);
  const conflictResponses = results.filter(r => r.statusCode === 409);

  console.log(`  Processed: ${successfulProcessed.length}, Cached: ${cachedResponses.length}, Conflicts: ${conflictResponses.length}`);

  // Should have exactly 1 processed + rest either cached or conflict
  if (successfulProcessed.length === 1 && (cachedResponses.length + conflictResponses.length) === 4) {
    // Verify the final balance is only 100 (not 500)
    await new Promise(r => setTimeout(r, 200));

    const balanceResponse = await fetch(`${BASE_URL}/balance/${walletId}`);
    const balanceResult = await balanceResponse.json();

    if (balanceResult.balance === 100) {
      console.log('✅ PASSED: Rapid duplicate requests handled correctly');
    } else {
      console.log('Final balance:', balanceResult.balance);
      throw new Error('Balance should be 100, not multiplied by duplicate requests');
    }
  } else {
    console.log('Results:', results);
    throw new Error('Expected exactly 1 processed request and 4 cached/conflict');
  }
}

// ============================================================
// TEST 10: Withdraw without idempotency key returns 400
// ============================================================
async function testWithdrawMissingIdempotencyKey(): Promise<void> {
  console.log('\n=== TEST: Withdraw Without Idempotency Key Returns 400 ===');

  const response = await fetch(`${BASE_URL}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletId: generateWalletId(), amount: 50 }),
  });

  if (response.status === 400) {
    const result = await response.json();
    if (result.message?.includes('x-idempotency-key')) {
      console.log('✅ PASSED: Withdraw without idempotency key correctly returns 400');
      return;
    }
  }

  console.log('Response status:', response.status);
  throw new Error('Withdraw without idempotency key should return 400');
}

// ============================================================
// TEST 11: Transfer without idempotency key returns 400
// ============================================================
async function testTransferMissingIdempotencyKey(): Promise<void> {
  console.log('\n=== TEST: Transfer Without Idempotency Key Returns 400 ===');

  const response = await fetch(`${BASE_URL}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      fromWalletId: generateWalletId(), 
      toWalletId: generateWalletId(), 
      amount: 50 
    }),
  });

  if (response.status === 400) {
    const result = await response.json();
    if (result.message?.includes('x-idempotency-key')) {
      console.log('✅ PASSED: Transfer without idempotency key correctly returns 400');
      return;
    }
  }

  console.log('Response status:', response.status);
  throw new Error('Transfer without idempotency key should return 400');
}

// ============================================================
// TEST 12: Cached response preserves original data
// ============================================================
async function testCachedResponsePreservesOriginalData(): Promise<void> {
  console.log('\n=== TEST: Cached Response Preserves Original Data ===');

  const walletId = generateWalletId();
  const idempotencyKey = generateKey();

  // First request with amount 250
  const firstResponse = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify({ walletId, amount: 250 }),
  });

  const firstResult = await firstResponse.json();

  await new Promise(r => setTimeout(r, 100));

  // Second request with DIFFERENT amount but same key - should return original amount
  const secondResponse = await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify({ walletId, amount: 999 }), // Different amount!
  });

  const secondResult = await secondResponse.json();

  // Should return cached response with original balance (250), not the new amount
  if (secondResult._cached === true && secondResult.balance === 250) {
    console.log('✅ PASSED: Cached response preserves original data (ignores new payload)');
  } else {
    console.log('First result:', firstResult);
    console.log('Second result:', secondResult);
    throw new Error('Cached response should preserve original response data');
  }
}

// ============================================================
// Run all tests
// ============================================================
(async () => {
  console.log('🚀 Starting Idempotency E2E Tests\n');
  console.log('Prerequisites:');
  console.log('  - API Gateway running on port 3000');
  console.log('  - Redis running for idempotency storage');
  console.log('  - All microservices running');
  console.log('');

  const tests = [
    testMissingIdempotencyKey,
    testValidRequestWithIdempotencyKey,
    testDuplicateRequestReturnsCachedResponse,
    testDifferentIdempotencyKeysAreIndependent,
    testIdempotencyPreventsDoubleWithdraw,
    testGetEndpointsDontRequireIdempotency,
    testIdempotencyAcrossEndpoints,
    testIdempotencyPreventsDoubleTransfer,
    testRapidDuplicateRequests,
    testWithdrawMissingIdempotencyKey,
    testTransferMissingIdempotencyKey,
    testCachedResponsePreservesOriginalData,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      failed++;
      console.error(`\n❌ ${test.name} failed:`, error);
    }
  }

  console.log('\n========================================');
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n✅ All idempotency tests passed!');
  }
})();

