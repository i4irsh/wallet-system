/**
 * Fraud Detection Service Integration Tests
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
 * Run with: npm run test:integration:fraud
 */

import { Client } from 'pg';
import {
  checkServicesRunning,
  delay,
  deposit,
  generateIdempotencyKey,
  generateWalletId,
  withdraw,
} from './helpers/test-helpers';

// ============================================================================
// FRAUD DB TYPES & CONFIG
// ============================================================================

const FRAUD_DB_CONFIG = {
  host: process.env.FRAUD_DB_HOST || 'localhost',
  port: parseInt(process.env.FRAUD_DB_PORT || '5434', 10),
  user: process.env.FRAUD_DB_USER || 'wallet_user',
  password: process.env.FRAUD_DB_PASSWORD || 'wallet_password',
  database: process.env.FRAUD_DB_NAME || 'wallet_fraud_db',
};

interface Alert {
  id: string;
  wallet_id: string;
  rule_id: string;
  rule_name: string;
  severity: string;
  transaction_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
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
// FRAUD DB HELPERS
// ============================================================================

let fraudDbClient: Client;

async function connectFraudDb(): Promise<void> {
  fraudDbClient = new Client(FRAUD_DB_CONFIG);
  await fraudDbClient.connect();
}

async function disconnectFraudDb(): Promise<void> {
  if (fraudDbClient) {
    await fraudDbClient.end();
  }
}

interface RecentEvent {
  id: string;
  wallet_id: string;
  event_type: string;
  amount: number;
  transaction_id: string;
  created_at: Date;
}

async function getAlerts(walletId: string): Promise<Alert[]> {
  const result = await fraudDbClient.query(
    'SELECT * FROM alerts WHERE wallet_id = $1 ORDER BY created_at DESC',
    [walletId],
  );
  return result.rows;
}

async function getAlertsByTransactionId(transactionId: string): Promise<Alert[]> {
  const result = await fraudDbClient.query(
    'SELECT * FROM alerts WHERE transaction_id = $1 ORDER BY created_at DESC',
    [transactionId],
  );
  return result.rows;
}

async function getRiskProfile(walletId: string): Promise<RiskProfile | null> {
  const result = await fraudDbClient.query('SELECT * FROM risk_profiles WHERE wallet_id = $1', [
    walletId,
  ]);
  return result.rows[0] || null;
}

async function getRecentEvents(walletId: string): Promise<RecentEvent[]> {
  const result = await fraudDbClient.query(
    'SELECT * FROM recent_events WHERE wallet_id = $1 ORDER BY created_at DESC',
    [walletId],
  );
  return result.rows;
}

async function clearTestData(walletId: string): Promise<void> {
  await fraudDbClient.query('DELETE FROM alerts WHERE wallet_id = $1', [walletId]);
  await fraudDbClient.query('DELETE FROM risk_profiles WHERE wallet_id = $1', [walletId]);
  await fraudDbClient.query('DELETE FROM recent_events WHERE wallet_id = $1', [walletId]);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Fraud Detection Service Tests', () => {
  jest.setTimeout(60000);

  beforeAll(async () => {
    await checkServicesRunning();

    // Connect to fraud database
    try {
      await connectFraudDb();
    } catch {
      throw new Error(
        'Cannot connect to fraud database!\n' +
          'Make sure postgres-fraud is running on port 5434:\n' +
          '  docker-compose up -d postgres-fraud',
      );
    }
  });

  afterAll(async () => {
    await disconnectFraudDb();
  });

  describe('Large Transaction Alert', () => {
    it('should trigger HIGH severity alert for transaction > $10,000', async () => {
      const walletId = generateWalletId('fraud');
      await clearTestData(walletId);

      // Make a large deposit ($15,000)
      const idempotencyKey = generateIdempotencyKey('large-deposit');
      const result = await deposit(walletId, 15000, idempotencyKey);
      expect(result.status).toBe(201);

      // Wait for fraud service to process
      await delay(300);

      // Check alerts
      const alerts = await getAlerts(walletId);
      const largeTransactionAlert = alerts.find((a) => a.rule_id === 'large-transaction');

      expect(largeTransactionAlert).toBeDefined();
      expect(largeTransactionAlert!.severity).toBe('HIGH');
    });

    it('should update risk profile with +30 points for HIGH severity alert', async () => {
      const walletId = generateWalletId('fraud');
      await clearTestData(walletId);

      // Make a large deposit
      await deposit(walletId, 15000, generateIdempotencyKey('risk-deposit'));
      await delay(300);

      // Check risk profile
      const profile = await getRiskProfile(walletId);
      expect(profile).toBeDefined();
      expect(profile!.risk_score).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Velocity Alert', () => {
    it('should trigger MEDIUM severity alert for >5 transactions in 10 minutes', async () => {
      const walletId = generateWalletId('fraud');
      await clearTestData(walletId);

      // Make 7 rapid deposits (more than velocity threshold of 5)
      for (let i = 1; i <= 7; i++) {
        const idempotencyKey = generateIdempotencyKey(`velocity-${walletId}-${i}`);
        await deposit(walletId, 100, idempotencyKey);
        await delay(100);
      }

      // Wait for fraud service to process all events
      await delay(800);

      // Check alerts
      const alerts = await getAlerts(walletId);
      const velocityAlerts = alerts.filter((a) => a.rule_id === 'high-velocity');

      expect(velocityAlerts.length).toBeGreaterThan(0);
      expect(velocityAlerts[0].severity).toBe('MEDIUM');
    });
  });

  describe('Rapid Withdrawal Alert', () => {
    it('should trigger HIGH severity alert for withdrawal within 5 minutes of deposit', async () => {
      const walletId = generateWalletId('fraud');
      await clearTestData(walletId);

      // Make a deposit
      const depositKey = generateIdempotencyKey('rapid-deposit');
      const depositResult = await deposit(walletId, 1000, depositKey);
      expect(depositResult.status).toBe(201);

      // Wait for the deposit to be tracked
      await delay(300);

      // Make a withdrawal (should trigger rapid withdrawal alert)
      const withdrawKey = generateIdempotencyKey('rapid-withdraw');
      const withdrawResult = await withdraw(walletId, 500, withdrawKey);
      expect(withdrawResult.status).toBe(201);

      // Wait for fraud service to process
      await delay(300);

      // Check alerts
      const alerts = await getAlerts(walletId);
      const rapidWithdrawalAlert = alerts.find((a) => a.rule_id === 'rapid-withdrawal');

      expect(rapidWithdrawalAlert).toBeDefined();
      expect(rapidWithdrawalAlert!.severity).toBe('HIGH');
    });
  });

  describe('Risk Score Accumulation', () => {
    it('should accumulate risk score with multiple alerts', async () => {
      const walletId = generateWalletId('fraud');
      await clearTestData(walletId);

      // Step 1: Large deposit (HIGH severity, +30 points)
      await deposit(walletId, 15000, generateIdempotencyKey('risk-1'));
      await delay(300);

      let profile = await getRiskProfile(walletId);
      const scoreAfterFirstAlert = profile?.risk_score ?? 0;
      expect(scoreAfterFirstAlert).toBeGreaterThanOrEqual(30);

      // Step 2: Immediate withdrawal (HIGH severity for rapid withdrawal, +30 points)
      await withdraw(walletId, 5000, generateIdempotencyKey('risk-2'));
      await delay(300);

      profile = await getRiskProfile(walletId);
      expect(profile!.risk_score).toBeGreaterThan(scoreAfterFirstAlert);

      // Step 3: Another large transaction
      await deposit(walletId, 12000, generateIdempotencyKey('risk-3'));
      await delay(300);

      // Final check
      profile = await getRiskProfile(walletId);
      expect(profile).toBeDefined();
      expect(profile!.alert_count).toBeGreaterThanOrEqual(3);

      // Risk level should escalate based on accumulated score
      if (profile!.risk_score >= 75) {
        expect(profile!.risk_level).toBe('CRITICAL');
      } else if (profile!.risk_score >= 50) {
        expect(profile!.risk_level).toBe('HIGH');
      } else if (profile!.risk_score >= 25) {
        expect(profile!.risk_level).toBe('MEDIUM');
      }
    });
  });

  describe('No Alert for Normal Transaction', () => {
    it('should not trigger fraud alert for normal transaction (< $10,000)', async () => {
      const walletId = generateWalletId('fraud');
      await clearTestData(walletId);

      // Make a normal deposit ($500)
      await deposit(walletId, 500, generateIdempotencyKey('normal-deposit'));

      // Wait for processing
      await delay(300);

      // Check alerts (should be none for fraud rules)
      const alerts = await getAlerts(walletId);
      const fraudAlerts = alerts.filter(
        (a) =>
          a.rule_id === 'large-transaction' ||
          a.rule_id === 'high-velocity' ||
          a.rule_id === 'rapid-withdrawal',
      );

      expect(fraudAlerts.length).toBe(0);
    });

    it('should keep risk profile at LOW level for normal transactions', async () => {
      const walletId = generateWalletId('fraud');
      await clearTestData(walletId);

      // Make a normal deposit
      await deposit(walletId, 500, generateIdempotencyKey('normal-deposit'));
      await delay(300);

      // Check risk profile
      const profile = await getRiskProfile(walletId);

      // Either no profile created, or profile with LOW risk
      if (profile) {
        expect(profile.risk_score).toBe(0);
        expect(profile.risk_level).toBe('LOW');
      }
    });
  });

  // ==========================================================================
  // EVENT CONSUMER IDEMPOTENCY TESTS
  // ==========================================================================

  describe('Event Consumer Idempotency', () => {
    describe('Duplicate API Request Handling', () => {
      it('should not create duplicate alerts when same idempotency key is used', async () => {
        const walletId = generateWalletId('idem-consumer');
        const idempotencyKey = generateIdempotencyKey('duplicate-test');
        await clearTestData(walletId);

        // Make a large deposit that triggers fraud alert
        const result1 = await deposit(walletId, 15000, idempotencyKey);
        expect(result1.status).toBe(201);

        await delay(300);

        // Count alerts after first request
        const alertsAfterFirst = await getAlerts(walletId);
        const largeTransactionAlertsFirst = alertsAfterFirst.filter(
          (a) => a.rule_id === 'large-transaction',
        );

        // Make duplicate request with same idempotency key
        const result2 = await deposit(walletId, 15000, idempotencyKey);

        await delay(300);

        // Count alerts after duplicate request
        const alertsAfterSecond = await getAlerts(walletId);
        const largeTransactionAlertsSecond = alertsAfterSecond.filter(
          (a) => a.rule_id === 'large-transaction',
        );

        // CRITICAL: Duplicate API call should NOT create additional alerts
        expect(largeTransactionAlertsSecond.length).toBe(largeTransactionAlertsFirst.length);
        expect(result2.data._cached).toBe(true);
      });

      it('should not double-count risk score on duplicate requests', async () => {
        const walletId = generateWalletId('idem-consumer');
        const idempotencyKey = generateIdempotencyKey('risk-score-test');
        await clearTestData(walletId);

        // Make a large deposit
        await deposit(walletId, 15000, idempotencyKey);
        await delay(300);

        const profileAfterFirst = await getRiskProfile(walletId);
        const scoreAfterFirst = profileAfterFirst?.risk_score ?? 0;

        // Make duplicate request
        await deposit(walletId, 15000, idempotencyKey);
        await delay(300);

        const profileAfterSecond = await getRiskProfile(walletId);
        const scoreAfterSecond = profileAfterSecond?.risk_score ?? 0;

        // Risk score should not increase on duplicate request
        expect(scoreAfterSecond).toBe(scoreAfterFirst);
      });

      it('should not create duplicate event records on duplicate requests', async () => {
        const walletId = generateWalletId('idem-consumer');
        const idempotencyKey = generateIdempotencyKey('event-record-test');
        await clearTestData(walletId);

        // Make initial deposit
        await deposit(walletId, 1000, idempotencyKey);
        await delay(300);

        const eventsAfterFirst = await getRecentEvents(walletId);
        const eventCountFirst = eventsAfterFirst.length;

        // Make duplicate request
        await deposit(walletId, 1000, idempotencyKey);
        await delay(300);

        const eventsAfterSecond = await getRecentEvents(walletId);
        const eventCountSecond = eventsAfterSecond.length;

        // Event count should not increase on duplicate request
        expect(eventCountSecond).toBe(eventCountFirst);
      });
    });

    describe('Rapid Duplicate Request Handling', () => {
      it('should handle rapid duplicate requests without creating duplicate alerts', async () => {
        const walletId = generateWalletId('rapid-idem');
        const idempotencyKey = generateIdempotencyKey('rapid-duplicate');
        await clearTestData(walletId);

        // Fire 5 simultaneous requests with same idempotency key (large deposit)
        const results = await Promise.all([
          deposit(walletId, 15000, idempotencyKey),
          deposit(walletId, 15000, idempotencyKey),
          deposit(walletId, 15000, idempotencyKey),
          deposit(walletId, 15000, idempotencyKey),
          deposit(walletId, 15000, idempotencyKey),
        ]);

        await delay(800);

        // Only one should have been processed
        const processedCount = results.filter((r) => !r.data._cached && r.status === 201).length;
        expect(processedCount).toBe(1);

        // Should have only ONE alert
        const alerts = await getAlerts(walletId);
        const largeTransactionAlerts = alerts.filter((a) => a.rule_id === 'large-transaction');
        expect(largeTransactionAlerts.length).toBe(1);
      });

      it('should maintain consistent risk score under rapid duplicate requests', async () => {
        const walletId = generateWalletId('rapid-risk');
        const idempotencyKey = generateIdempotencyKey('rapid-risk-test');
        await clearTestData(walletId);

        // Fire rapid duplicate requests
        await Promise.all([
          deposit(walletId, 15000, idempotencyKey),
          deposit(walletId, 15000, idempotencyKey),
          deposit(walletId, 15000, idempotencyKey),
        ]);

        await delay(800);

        const profile = await getRiskProfile(walletId);

        // Risk score should reflect only ONE large transaction alert (+30 for HIGH severity)
        expect(profile?.risk_score).toBeGreaterThanOrEqual(30);
        expect(profile?.risk_score).toBeLessThan(90); // Not 3x the expected score
      });
    });

    describe('Multiple Distinct Transactions', () => {
      it('should correctly process multiple distinct transactions', async () => {
        const walletId = generateWalletId('multi-tx');
        await clearTestData(walletId);

        // Make 3 distinct large deposits with different idempotency keys
        const key1 = generateIdempotencyKey('tx-1');
        const key2 = generateIdempotencyKey('tx-2');
        const key3 = generateIdempotencyKey('tx-3');

        await deposit(walletId, 15000, key1);
        await delay(300);
        await deposit(walletId, 15000, key2);
        await delay(300);
        await deposit(walletId, 15000, key3);
        await delay(800);

        // Should have 3 separate alerts (one per transaction)
        const alerts = await getAlerts(walletId);
        const largeTransactionAlerts = alerts.filter((a) => a.rule_id === 'large-transaction');

        expect(largeTransactionAlerts.length).toBe(3);

        // Risk score should reflect all 3 alerts
        const profile = await getRiskProfile(walletId);
        expect(profile?.risk_score).toBeGreaterThanOrEqual(90); // 3 * 30 = 90
      });

      it('should track each transaction event separately', async () => {
        const walletId = generateWalletId('event-track');
        await clearTestData(walletId);

        const key1 = generateIdempotencyKey('event-1');
        const key2 = generateIdempotencyKey('event-2');

        await deposit(walletId, 500, key1);
        await delay(300);
        await deposit(walletId, 600, key2);
        await delay(300);

        const events = await getRecentEvents(walletId);

        // Should have 2 distinct events
        expect(events.length).toBe(2);

        // Verify amounts are correct
        const amounts = events.map((e) => parseFloat(String(e.amount)));
        expect(amounts).toContain(500);
        expect(amounts).toContain(600);
      });
    });

    describe('Transaction ID Deduplication', () => {
      it('should associate alerts with correct transaction IDs', async () => {
        const walletId = generateWalletId('tx-id-test');
        await clearTestData(walletId);

        // Create large deposit
        await deposit(walletId, 15000, generateIdempotencyKey('tx-assoc-1'));
        await delay(300);

        // Get alerts and verify they have transaction IDs
        const alerts = await getAlerts(walletId);

        expect(alerts.length).toBeGreaterThan(0);
        // Each alert should have a transaction_id from the event
        alerts.forEach((alert) => {
          expect(alert.transaction_id).toBeTruthy();
        });
      });

      it('should not create duplicate alerts for same transaction ID', async () => {
        const walletId = generateWalletId('tx-dedup');
        const idempotencyKey = generateIdempotencyKey('tx-dedup-test');
        await clearTestData(walletId);

        // First request
        await deposit(walletId, 15000, idempotencyKey);
        await delay(300);

        const alertsFirst = await getAlerts(walletId);

        // Get the transaction ID from the first alert
        const transactionId = alertsFirst[0]?.transaction_id;
        expect(transactionId).toBeTruthy();

        // Duplicate request with same idempotency key
        await deposit(walletId, 15000, idempotencyKey);
        await delay(300);

        // Check alerts by transaction ID
        if (transactionId) {
          const alertsForTx = await getAlertsByTransactionId(transactionId);
          // Should only have ONE alert per transaction ID
          const largeTransactionAlerts = alertsForTx.filter(
            (a) => a.rule_id === 'large-transaction',
          );
          expect(largeTransactionAlerts.length).toBe(1);
        }
      });
    });

    describe('Velocity Rule Idempotency', () => {
      it('should not double-count transactions for velocity checks on duplicates', async () => {
        const walletId = generateWalletId('velocity-idem');
        await clearTestData(walletId);

        // Make 6 deposits rapidly (threshold is 5 for velocity alert)
        const keys: string[] = [];
        for (let i = 0; i < 6; i++) {
          keys.push(generateIdempotencyKey(`velocity-${i}`));
        }

        // Make deposits with unique keys
        for (const key of keys) {
          await deposit(walletId, 100, key);
          await delay(100);
        }

        await delay(800);

        const alerts = await getAlerts(walletId);
        const velocityAlerts = alerts.filter((a) => a.rule_id === 'high-velocity');

        // Should have velocity alerts triggered (>5 transactions)
        expect(velocityAlerts.length).toBeGreaterThan(0);

        // Now make duplicate requests with same keys
        for (const key of keys) {
          await deposit(walletId, 100, key);
          await delay(50);
        }

        await delay(800);

        const alertsAfterDuplicates = await getAlerts(walletId);
        const velocityAlertsAfter = alertsAfterDuplicates.filter(
          (a) => a.rule_id === 'high-velocity',
        );

        // Velocity alert count should NOT increase from duplicates
        expect(velocityAlertsAfter.length).toBe(velocityAlerts.length);
      });
    });

    describe('Alert Count Consistency', () => {
      it('should maintain correct alert_count in risk profile under duplicates', async () => {
        const walletId = generateWalletId('alert-count');
        await clearTestData(walletId);

        const key1 = generateIdempotencyKey('count-1');
        const key2 = generateIdempotencyKey('count-2');

        // First large deposit
        await deposit(walletId, 15000, key1);
        await delay(300);

        const profileAfterFirst = await getRiskProfile(walletId);
        const alertCountFirst = profileAfterFirst?.alert_count ?? 0;

        // Duplicate of first deposit
        await deposit(walletId, 15000, key1);
        await delay(300);

        const profileAfterDuplicate = await getRiskProfile(walletId);
        const alertCountAfterDuplicate = profileAfterDuplicate?.alert_count ?? 0;

        // Alert count should not increase on duplicate
        expect(alertCountAfterDuplicate).toBe(alertCountFirst);

        // New deposit with different key
        await deposit(walletId, 15000, key2);
        await delay(300);

        const profileAfterNew = await getRiskProfile(walletId);
        const alertCountAfterNew = profileAfterNew?.alert_count ?? 0;

        // Alert count should increase for new transaction
        expect(alertCountAfterNew).toBeGreaterThan(alertCountAfterDuplicate);
      });
    });
  });
});
