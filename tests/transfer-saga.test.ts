/**
 * Transfer Saga E2E Tests
 * 
 * Run with: npx ts-node tests/transfer-saga.test.ts
 */

const BASE_URL = 'http://localhost:3000';

async function testTransferSagaHappyPath(): Promise<void> {
  console.log('\n=== TEST: Transfer Saga Happy Path ===');

  const fromWalletId = `saga-test-from-${Date.now()}`;
  const toWalletId = `saga-test-to-${Date.now()}`;

  // Setup: Create both wallets
  await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletId: fromWalletId, amount: 500 }),
  });
  
  await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletId: toWalletId, amount: 100 }),
  });

  await new Promise(r => setTimeout(r, 100));

  // Execute transfer
  const transferResponse = await fetch(`${BASE_URL}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromWalletId, toWalletId, amount: 200 }),
  });

  const result = await transferResponse.json();

  console.log('Transfer result:', result);

  if (result.success && result.fromBalance === 300 && result.toBalance === 300) {
    console.log('✅ PASSED: Transfer completed correctly');
  } else {
    console.log('❌ FAILED: Unexpected transfer result');
    throw new Error('Transfer saga happy path failed');
  }
}

async function testTransferSagaInsufficientFunds(): Promise<void> {
  console.log('\n=== TEST: Transfer Saga - Insufficient Funds ===');

  const fromWalletId = `saga-test-low-${Date.now()}`;
  const toWalletId = `saga-test-target-${Date.now()}`;

  // Setup: Create wallet with only $50
  await fetch(`${BASE_URL}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletId: fromWalletId, amount: 50 }),
  });

  await new Promise(r => setTimeout(r, 100));

  // Attempt transfer of $100 (should fail)
  const transferResponse = await fetch(`${BASE_URL}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromWalletId, toWalletId, amount: 100 }),
  });

  const result = await transferResponse.json();

  console.log('Transfer result:', result);

  if (!result.success && result.error?.includes('Insufficient')) {
    console.log('✅ PASSED: Transfer correctly rejected for insufficient funds');
  } else {
    console.log('❌ FAILED: Transfer should have failed');
    throw new Error('Transfer saga insufficient funds test failed');
  }
}

// Run tests
(async () => {
  try {
    await testTransferSagaHappyPath();
    await testTransferSagaInsufficientFunds();
    console.log('\n✅ All saga tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
})();