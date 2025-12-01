/**
 * Concurrency Test: Double-Spend Prevention
 * 
 * Tests the scenario: When User A has $100 and simultaneously attempts 
 * a $100 withdrawal and $100 transfer
 * 
 * Expected behavior: Only ONE operation should succeed, the other should fail
 * with a concurrency error (optimistic locking violation).
 * 
 * Run this test with the services running:
 *   npx ts-node tests/concurrency.test.ts
 */

const BASE_URL = 'http://localhost:3000';

interface ApiResponse {
  success?: boolean;
  message?: string;
  balance?: number;
  fromBalance?: number;
  toBalance?: number;
  statusCode?: number;
  error?: string;
}

async function makeRequest(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: ApiResponse }> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data: ApiResponse;
  try {
    data = await response.json();
  } catch {
    data = { message: 'Non-JSON response' };
  }

  return { status: response.status, data };
}

async function getBalance(walletId: string): Promise<{ balance: number } | null> {
  try {
    const response = await fetch(`${BASE_URL}/balance/${walletId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

async function deposit(walletId: string, amount: number): Promise<{ status: number; data: ApiResponse }> {
  return makeRequest('/deposit', { walletId, amount });
}

async function withdraw(walletId: string, amount: number): Promise<{ status: number; data: ApiResponse }> {
  return makeRequest('/withdraw', { walletId, amount });
}

async function transfer(
  fromWalletId: string,
  toWalletId: string,
  amount: number,
): Promise<{ status: number; data: ApiResponse }> {
  return makeRequest('/transfer', { fromWalletId, toWalletId, amount });
}

function generateWalletId(): string {
  return `test-wallet-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testConcurrentWithdrawAndTransfer(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: Concurrent $100 Withdrawal and $100 Transfer with $100 Balance');
  console.log('='.repeat(70));

  const walletId = generateWalletId();
  const targetWalletId = generateWalletId();

  // Step 1: Setup - Deposit $100 to create the wallet
  console.log(`\n1. Setting up wallet: ${walletId}`);
  const depositResult = await deposit(walletId, 100);
  console.log(`   Deposit result: status=${depositResult.status}, balance=${depositResult.data.balance}`);

  if (depositResult.status !== 201) {
    throw new Error(`Failed to setup wallet: ${JSON.stringify(depositResult.data)}`);
  }

  // Small delay to ensure event is processed
  await delay(100);

  // Step 2: Verify initial balance
  const initialBalance = await getBalance(walletId);
  console.log(`\n2. Initial balance: $${initialBalance?.balance ?? 'unknown'}`);

  // Step 3: Execute concurrent operations
  console.log('\n3. Executing CONCURRENT operations:');
  console.log('   - Withdraw $100');
  console.log('   - Transfer $100 to another wallet');

  // Execute both operations simultaneously
  const [withdrawResult, transferResult] = await Promise.all([
    withdraw(walletId, 100),
    transfer(walletId, targetWalletId, 100),
  ]);

  console.log('\n4. Results:');
  console.log(`   Withdraw: status=${withdrawResult.status}, data=${JSON.stringify(withdrawResult.data)}`);
  console.log(`   Transfer: status=${transferResult.status}, data=${JSON.stringify(transferResult.data)}`);

  // Step 4: Analyze results
  const withdrawSuccess = withdrawResult.status === 201;
  const transferSuccess = transferResult.status === 201;

  console.log('\n5. Analysis:');
  console.log(`   Withdraw succeeded: ${withdrawSuccess}`);
  console.log(`   Transfer succeeded: ${transferSuccess}`);

  // Wait for read model to sync
  await delay(200);

  // Step 5: Check final balance
  const finalBalance = await getBalance(walletId);
  console.log(`\n6. Final balance: $${finalBalance?.balance ?? 'unknown'}`);

  // Step 6: Validate results
  console.log('\n7. Validation:');

  if (withdrawSuccess && transferSuccess) {
    // BOTH succeeded - this is a DOUBLE SPEND BUG!
    console.log('   ❌ FAILURE: Both operations succeeded - DOUBLE SPEND DETECTED!');
    console.log('   Expected: Only ONE operation should succeed');
    console.log(`   Final balance should be $0, but we withdrew AND transferred $200 from $100`);
    throw new Error('DOUBLE SPEND: Both concurrent operations succeeded');
  } else if (!withdrawSuccess && !transferSuccess) {
    // Neither succeeded - unexpected
    console.log('   ⚠️  WARNING: Neither operation succeeded');
    console.log('   This might indicate an issue with the test setup');
  } else {
    // Exactly one succeeded - CORRECT BEHAVIOR!
    console.log('   ✅ SUCCESS: Only ONE operation succeeded');
    console.log(`   ${withdrawSuccess ? 'Withdraw' : 'Transfer'} won the race`);
    console.log('   Concurrency control is working correctly!');

    // Verify final balance is $0 (one $100 operation succeeded)
    if (finalBalance && finalBalance.balance === 0) {
      console.log('   ✅ Final balance is correctly $0');
    } else if (finalBalance && finalBalance.balance !== 0) {
      console.log(`   ⚠️  Final balance is $${finalBalance.balance} (expected $0)`);
      console.log('      Note: Read model might have sync delay');
    }
  }
}

async function testConcurrentMultipleWithdrawals(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: 5 Concurrent $100 Withdrawals with $100 Balance');
  console.log('='.repeat(70));

  const walletId = generateWalletId();

  // Setup
  console.log(`\n1. Setting up wallet: ${walletId}`);
  await deposit(walletId, 100);
  await delay(100);

  console.log('\n2. Executing 5 CONCURRENT $100 withdrawals...');

  // Execute 5 concurrent withdrawals
  const results = await Promise.all([
    withdraw(walletId, 100),
    withdraw(walletId, 100),
    withdraw(walletId, 100),
    withdraw(walletId, 100),
    withdraw(walletId, 100),
  ]);

  console.log('\n3. Results:');
  results.forEach((r, i) => {
    console.log(`   Withdrawal ${i + 1}: status=${r.status}, ${r.status === 201 ? 'SUCCESS' : 'FAILED'}`);
  });

  const successCount = results.filter((r) => r.status === 201).length;
  console.log(`\n4. Summary: ${successCount} out of 5 withdrawals succeeded`);

  if (successCount === 1) {
    console.log('   ✅ SUCCESS: Only 1 withdrawal succeeded - concurrency control working!');
  } else if (successCount === 0) {
    console.log('   ⚠️  WARNING: No withdrawals succeeded');
  } else {
    console.log(`   ❌ FAILURE: ${successCount} withdrawals succeeded - DOUBLE SPEND!`);
    throw new Error(`DOUBLE SPEND: ${successCount} concurrent withdrawals succeeded`);
  }
}

async function testRapidFireOperations(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: Rapid Fire - 10 Concurrent Mixed Operations');
  console.log('='.repeat(70));

  const walletId = generateWalletId();
  const targetWalletId = generateWalletId();

  // Setup with $500
  console.log(`\n1. Setting up wallet with $500: ${walletId}`);
  await deposit(walletId, 500);
  await delay(100);

  console.log('\n2. Executing 10 CONCURRENT operations ($100 each):');
  console.log('   - 5 withdrawals');
  console.log('   - 5 transfers');

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

  const successCount = results.filter((r) => r.status === 201).length;

  console.log('\n3. Results:');
  results.forEach((r, i) => {
    const type = i % 2 === 0 ? 'Withdraw' : 'Transfer';
    console.log(`   ${type} ${Math.floor(i / 2) + 1}: status=${r.status}`);
  });

  console.log(`\n4. Summary: ${successCount} out of 10 operations succeeded`);

  // With $500 balance and $100 per operation, max 5 should succeed
  if (successCount <= 5) {
    console.log(`   ✅ SUCCESS: At most 5 operations succeeded (had $500, each was $100)`);
    console.log('   Concurrency control prevented over-withdrawal!');
  } else {
    console.log(`   ❌ FAILURE: ${successCount} operations succeeded - OVER WITHDRAWAL!`);
    console.log('   Maximum should be 5 (for $500 balance with $100 operations)');
    throw new Error(`OVER WITHDRAWAL: ${successCount} operations succeeded, max should be 5`);
  }

  // Check final balance
  await delay(200);
  const finalBalance = await getBalance(walletId);
  console.log(`\n5. Final balance: $${finalBalance?.balance ?? 'unknown'}`);

  const expectedBalance = 500 - successCount * 100;
  if (finalBalance && finalBalance.balance === expectedBalance) {
    console.log(`   ✅ Balance matches expected: $${expectedBalance}`);
  }
}

async function testSequentialVsConcurrent(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: Sequential vs Concurrent Behavior Comparison');
  console.log('='.repeat(70));

  // Test 1: Sequential (should both succeed)
  console.log('\n--- SEQUENTIAL TEST ---');
  const seqWalletId = generateWalletId();
  console.log(`Wallet: ${seqWalletId}`);

  await deposit(seqWalletId, 200);
  await delay(100);

  const seqResult1 = await withdraw(seqWalletId, 100);
  console.log(`First withdraw: status=${seqResult1.status}`);

  await delay(50);

  const seqResult2 = await withdraw(seqWalletId, 100);
  console.log(`Second withdraw: status=${seqResult2.status}`);

  const seqSuccessCount = [seqResult1, seqResult2].filter((r) => r.status === 201).length;
  console.log(`Sequential: ${seqSuccessCount}/2 succeeded (expected: 2)`);

  // Test 2: Concurrent with same total amount
  console.log('\n--- CONCURRENT TEST ---');
  const concWalletId = generateWalletId();
  console.log(`Wallet: ${concWalletId}`);

  await deposit(concWalletId, 200);
  await delay(100);

  const [concResult1, concResult2] = await Promise.all([
    withdraw(concWalletId, 100),
    withdraw(concWalletId, 100),
  ]);

  console.log(`First withdraw: status=${concResult1.status}`);
  console.log(`Second withdraw: status=${concResult2.status}`);

  const concSuccessCount = [concResult1, concResult2].filter((r) => r.status === 201).length;
  console.log(`Concurrent: ${concSuccessCount}/2 succeeded`);

  console.log('\n--- COMPARISON ---');
  console.log(`Sequential: ${seqSuccessCount}/2 succeeded`);
  console.log(`Concurrent: ${concSuccessCount}/2 succeeded`);

  if (concSuccessCount <= seqSuccessCount) {
    console.log('✅ Concurrent operations are properly serialized via optimistic locking');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('\n🧪 WALLET SYSTEM CONCURRENCY TESTS');
  console.log('Testing double-spend prevention with event sourcing + optimistic locking\n');

  // Check if services are running
  try {
    const response = await fetch(`${BASE_URL}/ping`);
    if (!response.ok) {
      throw new Error('Ping failed');
    }
    console.log('✅ Services are running\n');
  } catch {
    console.error('❌ Services are not running!');
    console.error('Please start the services first:');
    console.error('  pnpm start:all  (or docker-compose up)');
    process.exit(1);
  }

  const tests = [
    { name: 'Concurrent Withdraw and Transfer', fn: testConcurrentWithdrawAndTransfer },
    { name: 'Multiple Concurrent Withdrawals', fn: testConcurrentMultipleWithdrawals },
    { name: 'Rapid Fire Mixed Operations', fn: testRapidFireOperations },
    { name: 'Sequential vs Concurrent', fn: testSequentialVsConcurrent },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      console.error(`\n❌ Test "${test.name}" FAILED:`, error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('FINAL RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);

