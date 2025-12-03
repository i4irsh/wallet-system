/**
 * Common test helpers for integration tests
 *
 * Provides shared utilities for API requests, ID generation, and service health checks.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export const BASE_URL = process.env.API_URL || 'http://localhost:3000';
export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiResponse {
  success?: boolean;
  message?: string;
  balance?: number;
  fromBalance?: number;
  toBalance?: number;
  statusCode?: number;
  error?: string;
  _cached?: boolean;
  _idempotencyKey?: string;
}

export interface RequestResult {
  status: number;
  data: ApiResponse;
}

// ============================================================================
// ID GENERATORS
// ============================================================================

export function generateIdempotencyKey(prefix = 'idem'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function generateWalletId(prefix = 'test-wallet'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// ============================================================================
// UTILITIES
// ============================================================================

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// API REQUEST HELPERS
// ============================================================================

export async function makeRequest(
  endpoint: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<RequestResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (idempotencyKey !== undefined) {
    headers[IDEMPOTENCY_HEADER] = idempotencyKey;
  } else {
    // Auto-generate idempotency key if not provided
    headers[IDEMPOTENCY_HEADER] = generateIdempotencyKey();
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

/**
 * Make a request without idempotency key (for testing missing key scenarios)
 */
export async function makeRequestWithoutIdempotency(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<RequestResult> {
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

// ============================================================================
// WALLET API HELPERS
// ============================================================================

export async function deposit(
  walletId: string,
  amount: number,
  idempotencyKey?: string,
): Promise<RequestResult> {
  return makeRequest('/deposit', { walletId, amount }, idempotencyKey);
}

export async function withdraw(
  walletId: string,
  amount: number,
  idempotencyKey?: string,
): Promise<RequestResult> {
  return makeRequest('/withdraw', { walletId, amount }, idempotencyKey);
}

export async function transfer(
  fromWalletId: string,
  toWalletId: string,
  amount: number,
  idempotencyKey?: string,
): Promise<RequestResult> {
  return makeRequest('/transfer', { fromWalletId, toWalletId, amount }, idempotencyKey);
}

export async function getBalance(walletId: string): Promise<number | null> {
  try {
    const response = await fetch(`${BASE_URL}/balance/${walletId}`);
    if (response.ok) {
      const data = await response.json();
      return data.balance;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getTransactions(walletId: string): Promise<unknown[] | null> {
  try {
    const response = await fetch(`${BASE_URL}/transactions/${walletId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// SERVICE HEALTH CHECK
// ============================================================================

export async function checkServicesRunning(): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/ping`);
    if (!response.ok) {
      throw new Error('Ping failed');
    }
  } catch {
    throw new Error(
      'Services are not running! Please start the services first:\n' +
        '  npm run start:dev:all  (or docker-compose up)',
    );
  }
}

