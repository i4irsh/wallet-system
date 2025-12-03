/**
 * Fraud Detection Service Tests
 *
 * Tests the fraud detection rules:
 * 1. Large Transaction Alert - Amount > $10,000 → HIGH severity
 * 2. High Velocity Alert - >5 transactions in 10 minutes → MEDIUM severity
 * 3. Rapid Withdrawal Pattern - Withdrawal within 5 min of deposit → HIGH severity
 *
 * Risk Score Updates:
 * - LOW: +5, MEDIUM: +15, HIGH: +30, CRITICAL: +50
 * - Risk Levels: 0-25 LOW, 26-50 MEDIUM, 51-75 HIGH, 76-100 CRITICAL
 *
 * Prerequisites:
 * - All services running (api-gateway, command-service, query-service, fraud-service)
 * - PostgreSQL fraud database running on port 5434
 *
 * Run this test with:
 *   npx ts-node tests/fraud.test.ts
 */

import { Client } from 'pg';

const BASE_URL = 'http://localhost:3000';

// Fraud DB connection config
const FRAUD_DB_CONFIG = {
  host: 'localhost',
  port: 5434,
  user: 'wallet_user',
  password: 'wallet_password',
  database: 'wallet_fraud_db',
};

interface ApiResponse {
  success?: boolean;
  message?: string;
  balance?: number;
  statusCode?: number;
  error?: string;
}

interface Alert {
  id: string;
  wallet_id: string;
  rule_id: string;
  rule_name: string;
  severity: string;
  transaction_id: string;
  event_type: string;
  event_data: Record<string, any>;
  created_at: Date;
}

interface RiskProfile {
  wallet_id: string;
  risk_score: number;
  risk_level: string;
  alert_count: number;
  last_updated: Date;
}

// ============================================================================
// HELPERS
// ============================================================================

let fraudDbClient: Client;

async function connectFraudDb(): Promise<void> {
  fraudDbClient = new Client(FRAUD_DB_CONFIG);
  await fraudDbClient.connect();
  console.log('✅ Connected to fraud database');
}

async function disconnectFraudDb(): Promise<void> {
  await fraudDbClient.end();
}

async function getAlerts(walletId: string): Promise<Alert[]> {
  const result = await fraudDbClient.query(
    'SELECT * FROM alerts WHERE wallet_id = $1 ORDER BY created_at DESC',
    [walletId],
  );
  return result.rows;
}

async function getRiskProfile(walletId: string): Promise<RiskProfile | null> {
  const result = await fraudDbClient.query(
    'SELECT * FROM risk_profiles WHERE wallet_id = $1',
    [walletId],
  );
  return result.rows[0] || null;
}

async function clearTestData(walletId: string): Promise<void> {
  await fraudDbClient.query('DELETE FROM alerts WHERE wallet_id = $1', [walletId]);
  await fraudDbClient.query('DELETE FROM risk_profiles WHERE wallet_id = $1', [walletId]);
  await fraudDbClient.query('DELETE FROM recent_events WHERE wallet_id = $1', [walletId]);
}

async function makeRequest(
  endpoint: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<{ status: number; data: ApiResponse }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idempotencyKey) {
    headers['x-idempotency-key'] = idempotencyKey;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
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

async function deposit(
  walletId: string,
  amount: number,
  idempotencyKey?: string,
): Promise<{ status: number; data: ApiResponse }> {
  return makeRequest('/deposit', { walletId, amount }, idempotencyKey);
}

async function withdraw(
  walletId: string,
  amount: number,
  idempotencyKey?: string,
): Promise<{ status: number; data: ApiResponse }> {
  return makeRequest('/withdraw', { walletId, amount }, idempotencyKey);
}

function generateWalletId(): string {
  return `fraud-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testLargeTransactionAlert(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: Large Transaction Alert (Amount > $10,000)');
  console.log('='.repeat(70));

  const walletId = generateWalletId();
  await clearTestData(walletId);

  console.log(`\n1. Wallet ID: ${walletId}`);

  // Make a large deposit ($15,000)
  console.log('\n2. Making large deposit of $15,000...');
  const idempotencyKey = `large-deposit-${Date.now()}`;
  const result = await deposit(walletId, 15000, idempotencyKey);
  console.log(`   Deposit result: status=${result.status}`);

  if (result.status !== 201) {
    throw new Error(`Deposit failed: ${JSON.stringify(result.data)}`);
  }

  // Wait for fraud service to process
  console.log('\n3. Waiting for fraud service to process event...');
  await delay(2000);

  // Check alerts
  console.log('\n4. Checking alerts in fraud database...');
  const alerts = await getAlerts(walletId);
  console.log(`   Found ${alerts.length} alert(s)`);

  const largeTransactionAlert = alerts.find((a) => a.rule_id === 'large-transaction');

  if (largeTransactionAlert) {
    console.log('\n5. Large Transaction Alert Details:');
    console.log(`   Rule ID: ${largeTransactionAlert.rule_id}`);
    console.log(`   Rule Name: ${largeTransactionAlert.rule_name}`);
    console.log(`   Severity: ${largeTransactionAlert.severity}`);
    console.log(`   Event Type: ${largeTransactionAlert.event_type}`);

    if (largeTransactionAlert.severity === 'HIGH') {
      console.log('\n   ✅ SUCCESS: Large transaction alert triggered with HIGH severity');
    } else {
      console.log(`\n   ⚠️  WARNING: Expected HIGH severity, got ${largeTransactionAlert.severity}`);
    }
  } else {
    console.log('\n   ❌ FAILURE: Large transaction alert was NOT triggered');
    throw new Error('Large transaction alert not found');
  }

  // Check risk profile
  console.log('\n6. Checking risk profile...');
  const profile = await getRiskProfile(walletId);
  if (profile) {
    console.log(`   Risk Score: ${profile.risk_score}`);
    console.log(`   Risk Level: ${profile.risk_level}`);
    console.log(`   Alert Count: ${profile.alert_count}`);

    if (profile.risk_score >= 30) {
      console.log('\n   ✅ Risk score increased correctly (+30 for HIGH severity)');
    }
  } else {
    console.log('   ⚠️  Risk profile not created yet');
  }
}

async function testVelocityAlert(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: High Velocity Alert (>5 transactions in 10 minutes)');
  console.log('='.repeat(70));

  const walletId = generateWalletId();
  await clearTestData(walletId);

  console.log(`\n1. Wallet ID: ${walletId}`);

  // Make 7 rapid deposits (more than velocity threshold of 5)
  console.log('\n2. Making 7 rapid deposits ($100 each)...');

  for (let i = 1; i <= 7; i++) {
    const idempotencyKey = `velocity-deposit-${walletId}-${i}`;
    const result = await deposit(walletId, 100, idempotencyKey);
    console.log(`   Deposit ${i}: status=${result.status}`);
    // Small delay between requests
    await delay(100);
  }

  // Wait for fraud service to process all events
  console.log('\n3. Waiting for fraud service to process events...');
  await delay(3000);

  // Check alerts
  console.log('\n4. Checking alerts in fraud database...');
  const alerts = await getAlerts(walletId);
  console.log(`   Found ${alerts.length} alert(s)`);

  const velocityAlerts = alerts.filter((a) => a.rule_id === 'high-velocity');

  if (velocityAlerts.length > 0) {
    console.log(`\n5. High Velocity Alerts: ${velocityAlerts.length} triggered`);
    console.log(`   First triggered after transaction count exceeded 5`);
    console.log(`   Severity: ${velocityAlerts[0].severity}`);

    if (velocityAlerts[0].severity === 'MEDIUM') {
      console.log('\n   ✅ SUCCESS: Velocity alert triggered with MEDIUM severity');
    } else {
      console.log(`\n   ⚠️  WARNING: Expected MEDIUM severity, got ${velocityAlerts[0].severity}`);
    }
  } else {
    console.log('\n   ❌ FAILURE: Velocity alert was NOT triggered');
    console.log('   Note: This may take time for events to be tracked');
    throw new Error('Velocity alert not found');
  }

  // Check risk profile
  console.log('\n6. Checking risk profile...');
  const profile = await getRiskProfile(walletId);
  if (profile) {
    console.log(`   Risk Score: ${profile.risk_score}`);
    console.log(`   Risk Level: ${profile.risk_level}`);
    console.log(`   Alert Count: ${profile.alert_count}`);
  }
}

async function testRapidWithdrawalAlert(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: Rapid Withdrawal Pattern (Withdrawal within 5 min of deposit)');
  console.log('='.repeat(70));

  const walletId = generateWalletId();
  await clearTestData(walletId);

  console.log(`\n1. Wallet ID: ${walletId}`);

  // First, make a deposit
  console.log('\n2. Making initial deposit of $1,000...');
  const depositKey = `rapid-deposit-${walletId}`;
  const depositResult = await deposit(walletId, 1000, depositKey);
  console.log(`   Deposit result: status=${depositResult.status}`);

  if (depositResult.status !== 201) {
    throw new Error(`Deposit failed: ${JSON.stringify(depositResult.data)}`);
  }

  // Wait a bit for the deposit to be tracked
  console.log('\n3. Waiting for deposit event to be tracked...');
  await delay(2000);

  // Now make a withdrawal (should trigger rapid withdrawal alert)
  console.log('\n4. Making withdrawal of $500 (within 5 min of deposit)...');
  const withdrawKey = `rapid-withdraw-${walletId}`;
  const withdrawResult = await withdraw(walletId, 500, withdrawKey);
  console.log(`   Withdrawal result: status=${withdrawResult.status}`);

  if (withdrawResult.status !== 201) {
    throw new Error(`Withdrawal failed: ${JSON.stringify(withdrawResult.data)}`);
  }

  // Wait for fraud service to process
  console.log('\n5. Waiting for fraud service to process events...');
  await delay(2000);

  // Check alerts
  console.log('\n6. Checking alerts in fraud database...');
  const alerts = await getAlerts(walletId);
  console.log(`   Found ${alerts.length} alert(s)`);

  alerts.forEach((a, i) => {
    console.log(`   Alert ${i + 1}: ${a.rule_name} (${a.severity}) - ${a.event_type}`);
  });

  const rapidWithdrawalAlert = alerts.find((a) => a.rule_id === 'rapid-withdrawal');

  if (rapidWithdrawalAlert) {
    console.log('\n7. Rapid Withdrawal Alert Details:');
    console.log(`   Rule ID: ${rapidWithdrawalAlert.rule_id}`);
    console.log(`   Rule Name: ${rapidWithdrawalAlert.rule_name}`);
    console.log(`   Severity: ${rapidWithdrawalAlert.severity}`);

    if (rapidWithdrawalAlert.severity === 'HIGH') {
      console.log('\n   ✅ SUCCESS: Rapid withdrawal alert triggered with HIGH severity');
    } else {
      console.log(`\n   ⚠️  WARNING: Expected HIGH severity, got ${rapidWithdrawalAlert.severity}`);
    }
  } else {
    console.log('\n   ❌ FAILURE: Rapid withdrawal alert was NOT triggered');
    throw new Error('Rapid withdrawal alert not found');
  }

  // Check risk profile
  console.log('\n8. Checking risk profile...');
  const profile = await getRiskProfile(walletId);
  if (profile) {
    console.log(`   Risk Score: ${profile.risk_score}`);
    console.log(`   Risk Level: ${profile.risk_level}`);
    console.log(`   Alert Count: ${profile.alert_count}`);
  }
}

async function testRiskScoreAccumulation(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: Risk Score Accumulation (Multiple alerts increase score)');
  console.log('='.repeat(70));

  const walletId = generateWalletId();
  await clearTestData(walletId);

  console.log(`\n1. Wallet ID: ${walletId}`);

  // Step 1: Large deposit (HIGH severity, +30 points)
  console.log('\n2. Step 1: Large deposit of $15,000 (HIGH severity alert)...');
  await deposit(walletId, 15000, `risk-test-1-${walletId}`);
  await delay(2000);

  let profile = await getRiskProfile(walletId);
  console.log(`   Risk Score after large deposit: ${profile?.risk_score ?? 0}`);

  // Step 2: Immediate withdrawal (HIGH severity for rapid withdrawal, +30 points)
  console.log('\n3. Step 2: Immediate withdrawal (HIGH severity - rapid withdrawal)...');
  await withdraw(walletId, 5000, `risk-test-2-${walletId}`);
  await delay(2000);

  profile = await getRiskProfile(walletId);
  console.log(`   Risk Score after rapid withdrawal: ${profile?.risk_score ?? 0}`);

  // Step 3: Another large transaction (HIGH severity, +30 points)
  console.log('\n4. Step 3: Another large deposit of $12,000...');
  await deposit(walletId, 12000, `risk-test-3-${walletId}`);
  await delay(2000);

  profile = await getRiskProfile(walletId);
  console.log(`   Risk Score after second large deposit: ${profile?.risk_score ?? 0}`);

  // Final check
  console.log('\n5. Final Risk Profile:');
  profile = await getRiskProfile(walletId);
  if (profile) {
    console.log(`   Wallet ID: ${profile.wallet_id}`);
    console.log(`   Risk Score: ${profile.risk_score}`);
    console.log(`   Risk Level: ${profile.risk_level}`);
    console.log(`   Alert Count: ${profile.alert_count}`);

    // Check risk level based on accumulated score
    if (profile.risk_score >= 75 && profile.risk_level === 'CRITICAL') {
      console.log('\n   ✅ SUCCESS: Risk level escalated to CRITICAL');
    } else if (profile.risk_score >= 50 && profile.risk_level === 'HIGH') {
      console.log('\n   ✅ SUCCESS: Risk level escalated to HIGH');
    } else if (profile.risk_score >= 25 && profile.risk_level === 'MEDIUM') {
      console.log('\n   ✅ SUCCESS: Risk level escalated to MEDIUM');
    } else {
      console.log(`\n   ℹ️  Risk level is ${profile.risk_level} with score ${profile.risk_score}`);
    }

    if (profile.alert_count >= 3) {
      console.log(`   ✅ Alert count is correct: ${profile.alert_count} alerts`);
    }
  } else {
    console.log('   ❌ FAILURE: Risk profile not found');
    throw new Error('Risk profile not created');
  }

  // Show all alerts
  console.log('\n6. All Alerts Generated:');
  const alerts = await getAlerts(walletId);
  alerts.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.rule_name} (${a.severity}) - ${a.event_type}`);
  });
}

async function testNoAlertForNormalTransaction(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('TEST: No Alert for Normal Transaction (Amount < $10,000)');
  console.log('='.repeat(70));

  const walletId = generateWalletId();
  await clearTestData(walletId);

  console.log(`\n1. Wallet ID: ${walletId}`);

  // Make a normal deposit ($500)
  console.log('\n2. Making normal deposit of $500...');
  const result = await deposit(walletId, 500, `normal-deposit-${walletId}`);
  console.log(`   Deposit result: status=${result.status}`);

  // Wait for processing
  console.log('\n3. Waiting for fraud service to process...');
  await delay(2000);

  // Check alerts (should be none or only tracking events)
  console.log('\n4. Checking alerts...');
  const alerts = await getAlerts(walletId);
  const fraudAlerts = alerts.filter((a) => a.rule_id !== 'info');

  if (fraudAlerts.length === 0) {
    console.log('   ✅ SUCCESS: No fraud alerts triggered for normal transaction');
  } else {
    console.log(`   ⚠️  WARNING: Found ${fraudAlerts.length} alert(s) for normal transaction`);
    fraudAlerts.forEach((a) => {
      console.log(`   - ${a.rule_name} (${a.severity})`);
    });
  }

  // Check risk profile
  console.log('\n5. Checking risk profile...');
  const profile = await getRiskProfile(walletId);
  if (profile) {
    console.log(`   Risk Score: ${profile.risk_score}`);
    console.log(`   Risk Level: ${profile.risk_level}`);

    if (profile.risk_score === 0 && profile.risk_level === 'LOW') {
      console.log('\n   ✅ SUCCESS: Risk profile remains at LOW level');
    }
  } else {
    console.log('   ✅ No risk profile created (no alerts triggered)');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('\n🕵️ FRAUD DETECTION SERVICE TESTS');
  console.log('Testing fraud rules: Large Transaction, Velocity, Rapid Withdrawal\n');

  // Check if API services are running
  try {
    const response = await fetch(`${BASE_URL}/ping`);
    if (!response.ok) {
      throw new Error('Ping failed');
    }
    console.log('✅ API Gateway is running');
  } catch {
    console.error('❌ API Gateway is not running!');
    console.error('Please start all services first.');
    process.exit(1);
  }

  // Connect to fraud database
  try {
    await connectFraudDb();
  } catch (error) {
    console.error('❌ Cannot connect to fraud database!');
    console.error('Make sure postgres-fraud is running on port 5434');
    console.error('Run: docker-compose up -d postgres-fraud');
    process.exit(1);
  }

  const tests = [
    { name: 'Large Transaction Alert', fn: testLargeTransactionAlert },
    { name: 'Velocity Alert', fn: testVelocityAlert },
    { name: 'Rapid Withdrawal Alert', fn: testRapidWithdrawalAlert },
    { name: 'Risk Score Accumulation', fn: testRiskScoreAccumulation },
    { name: 'No Alert for Normal Transaction', fn: testNoAlertForNormalTransaction },
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

  // Cleanup
  await disconnectFraudDb();

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
runAllTests().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});

