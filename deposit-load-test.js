import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const depositSuccess = new Counter('deposit_success');
const depositFailed = new Counter('deposit_failed');
const depositDuration = new Trend('deposit_duration');
const depositSuccessRate = new Rate('deposit_success_rate');

export const options = {
  scenarios: {
    concurrent_deposits: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 500 },  // Ramp up to 500 over 5 seconds
        { duration: '30s', target: 1000 }, // Stay at 1000 for 30 seconds
        { duration: '5s', target: 500 },     // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    deposit_success_rate: ['rate>0.9'],
  },
};

const BASE_URL = 'http://localhost:3000';

// Generate unique wallet IDs per VU iteration
function getWalletId() {
  return `wallet-${__VU}-${__ITER}`;
}

export default function () {
  const walletId = getWalletId();
  const headers = { 'Content-Type': 'application/json' };
  const idempotencyKey = uuidv4();

  const depositRes = http.post(
    `${BASE_URL}/deposit`,
    JSON.stringify({ walletId, amount: 100 }),
    { headers: { ...headers, 'x-idempotency-key': idempotencyKey } }
  );

  const depositOk = check(depositRes, {
    'deposit status 201': (r) => r.status === 201,
    'deposit has response': (r) => r.body && r.body.length > 0,
  });

  if (depositOk) {
    depositSuccess.add(1);
    depositSuccessRate.add(1);
  } else {
    depositFailed.add(1);
    depositSuccessRate.add(0);
    if (depositRes.status !== 201) {
      console.log(`Deposit failed: status=${depositRes.status}, body=${depositRes.body}`);
    }
  }
  depositDuration.add(depositRes.timings.duration);
}

export function handleSummary(data) {
  const depositSuccessCount = data.metrics.deposit_success?.values?.count || 0;
  const depositFailedCount = data.metrics.deposit_failed?.values?.count || 0;
  const totalDeposits = depositSuccessCount + depositFailedCount;
  const successRate = totalDeposits > 0 ? ((depositSuccessCount / totalDeposits) * 100).toFixed(2) : '0';

  const depositAvg = data.metrics.deposit_duration?.values?.avg?.toFixed(2) || '0';
  const depositMin = data.metrics.deposit_duration?.values?.min?.toFixed(2) || '0';
  const depositMax = data.metrics.deposit_duration?.values?.max?.toFixed(2) || '0';
  const depositP90 = data.metrics.deposit_duration?.values?.['p(90)']?.toFixed(2) || '0';
  const depositP95 = data.metrics.deposit_duration?.values?.['p(95)']?.toFixed(2) || '0';
  const depositP99 = data.metrics.deposit_duration?.values?.['p(99)']?.toFixed(2) || '0';

  const testDuration = String((data.state.testRunDurationMs / 1000).toFixed(2));
  const opsPerSecond = String((depositSuccessCount / (data.state.testRunDurationMs / 1000)).toFixed(2));

  // Helper to pad line content to fixed width
  const line = (content) => `║  ${content.padEnd(72)}║`;

  const summary = `
╔══════════════════════════════════════════════════════════════════════════╗
║          1K CONCURRENT DEPOSITS LOAD TEST RESULTS                        ║
╠══════════════════════════════════════════════════════════════════════════╣
${line('Configuration')}
${line(`├─ Concurrent VUs:     1000`)}
${line(`└─ Test Duration:      ${testDuration.padStart(8)}s`)}
╠══════════════════════════════════════════════════════════════════════════╣
${line('Results')}
${line(`├─ Successful:         ${String(depositSuccessCount).padStart(10)}`)}
${line(`├─ Failed:             ${String(depositFailedCount).padStart(10)}`)}
${line(`├─ Success Rate:       ${successRate.padStart(9)}%`)}
${line(`└─ Throughput:         ${opsPerSecond.padStart(10)} ops/sec`)}
╠══════════════════════════════════════════════════════════════════════════╣
${line('Latency (ms)')}
${line(`├─ Min:                ${depositMin.padStart(10)}`)}
${line(`├─ Avg:                ${depositAvg.padStart(10)}`)}
${line(`├─ Max:                ${depositMax.padStart(10)}`)}
${line(`├─ P90:                ${depositP90.padStart(10)}`)}
${line(`├─ P95:                ${depositP95.padStart(10)}`)}
${line(`└─ P99:                ${depositP99.padStart(10)}`)}
╚══════════════════════════════════════════════════════════════════════════╝
`;

  return {
    stdout: summary,
  };
}

