# Wallet System - Design Document

## Overview

A production-grade event-driven distributed Wallet Microservice implementing **CQRS** and **Event Sourcing** patterns using NestJS microservices.

---

## Design Decisions

### 1. CQRS (Command Query Responsibility Segregation)

**Decision:** Separate services for write (commands) and read (queries) operations.

**Reasoning:**
- Write and read operations have different scaling requirements
- Allows independent optimization of each path
- Write path focuses on consistency and event generation
- Read path focuses on fast retrieval from denormalized read models

**Trade-offs:**
- Increased complexity with multiple services
- Eventual consistency between write and read models
- Read model may be slightly behind the write model

| Concern | Service | Responsibility |
|---------|---------|----------------|
| Commands | command-service | Deposit, Withdraw, Transfer |
| Queries | query-service | Get Balance, Get Transactions |

### 2. Event Sourcing

**Decision:** Store all state changes as immutable events rather than current state.

**Reasoning:**
- Complete audit trail of all operations
- Ability to replay events to rebuild state
- Events can be published for downstream processing
- Supports temporal queries ("what was the balance at time X?")

**Trade-offs:**
- Increased storage requirements
- Aggregate reconstruction requires replaying events (can be mitigated with snapshots)
- More complex querying of current state

```
Events: [Deposit $100] → [Deposit $50] → [Withdraw $30]
                              ↓
                     Replay = Balance $120
```

### 3. Microservices Architecture

**Decision:** Three separate services communicating via TCP.

```
┌──────────┐      HTTP       ┌─────────────┐
│  Client  │◄───────────────►│ API Gateway │ :3000
└──────────┘                 └──────┬──────┘
                                    │ TCP
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
           ┌────────────────┐  Events (TCP)  ┌─────────────────┐
           │Command Service │───────────────►│  Query Service  │
           │     :3001      │                │      :3002      │
           └───────┬────────┘                └────────┬────────┘
                   │                                  │
                   ▼                                  ▼
           ┌──────────────┐                  ┌──────────────────┐
           │ Event Store  │                  │   Read Models    │
           └──────┬───────┘                  └────────┬─────────┘
                  │                                   │
                  └─────────────┬─────────────────────┘
                                ▼
                          ┌──────────┐
                          │ Postgres │ :5432
                          └──────────┘
```

**Reasoning:**
- Clear separation of concerns
- Independent deployment and scaling
- Fault isolation

### 4. PostgreSQL as Event Store

**Decision:** Use PostgreSQL with JSONB for event storage instead of a dedicated event store.

**Reasoning:**
- Simpler infrastructure (single database)
- JSONB provides flexible event payload storage
- Strong consistency guarantees
- Familiar tooling and operations

**Trade-offs:**
- May not scale as well as dedicated event stores for very high throughput
- Limited built-in event store features (subscriptions, projections)

### 5. Optimistic Concurrency Control

**Decision:** Use version numbers on aggregates to detect concurrent modifications.

**Reasoning:**
- Prevents lost updates when multiple operations target the same wallet
- Lightweight compared to pessimistic locking
- Fits naturally with event sourcing

**Implementation:**
- Each event has a version number
- Unique constraint on (aggregate_id, version) prevents duplicate versions
- If version conflict occurs, operation fails and can be retried

---

## Implementation Status

### ✅ Completed

| Requirement | Status | Details |
|-------------|--------|---------|
| Core API Endpoints | ✅ | Deposit, Withdraw, Transfer, Get Balance, Get History |
| Event Recording | ✅ | All operations stored as immutable events in event_store table |
| Event Publishing | ✅ | Events published to query-service via TCP |
| Audit Trail | ✅ | Complete event history with timestamps and transaction IDs |
| Read/Write Separation | ✅ | Command service (writes) and Query service (reads) |
| Read Model Projections | ✅ | wallet_read_model and transaction_read_model tables |
| Wallet Auto-Creation | ✅ | Wallets created on first operation |
| Basic Transfer | ✅ | Debit from source, credit to destination |

### ⏳ Pending

| Requirement | Status | Notes |
|-------------|--------|-------|
| Message Broker | ⏳ | Currently using TCP; need RabbitMQ/Kafka/Redis Streams |
| Async Background Worker | ⏳ | Need separate consumer service with business logic |
| Transfer for Distributed Transaction | ⏳ | Need saga/compensation for rollback on credit failure |
| Idempotency | ⏳ | Need request ID tracking for duplicate detection |
| Dead Letter Queue | ⏳ | Need DLQ for failed message processing |
| Test Suite | ⏳ | Need comprehensive tests |

---

## Data Flow

### Write Path (Synchronous Response)

```
1. Client sends POST /wallet/:id/deposit
2. API Gateway forwards to Command Service
3. Command Service:
   a. Loads wallet aggregate (replays events)
   b. Validates business rules
   c. Produces event (MoneyDepositedEvent)
   d. Saves event to event_store (PostgreSQL)
   e. Publishes event to message broker
4. Client receives immediate response
5. Background: Query Service consumes event, updates read model
```

### Read Path

```
1. Client sends GET /wallet/:id
2. API Gateway forwards to Query Service
3. Query Service reads from wallet_read_model
4. Client receives response
```

---

## Database Schema

### Event Store (Write Side)

```sql
event_store (
  id             SERIAL PRIMARY KEY,
  aggregate_id   VARCHAR(255),      -- wallet ID
  aggregate_type VARCHAR(255),      -- "WalletAggregate"
  event_type     VARCHAR(255),      -- "FundsDeposited", "FundsWithdrawn", etc.
  event_data     JSONB,             -- event payload
  version        INT,               -- optimistic concurrency
  timestamp      TIMESTAMPTZ,
  transaction_id VARCHAR(255),      -- unique per operation
  UNIQUE(aggregate_id, version)     -- prevents concurrent conflicts
)
```

### Read Models (Read Side)

```sql
wallet_read_model (
  id         VARCHAR(255) PRIMARY KEY,
  balance    DECIMAL(18,2),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

transaction_read_model (
  id                VARCHAR(255) PRIMARY KEY,
  wallet_id         VARCHAR(255),
  type              VARCHAR(50),    -- DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT
  amount            DECIMAL(18,2),
  balance_after     DECIMAL(18,2),
  related_wallet_id VARCHAR(255),   -- for transfers
  timestamp         TIMESTAMPTZ
)
```

---

## Components

### Command Service

| Component | Purpose |
|-----------|---------|
| Commands | `DepositCommand`, `WithdrawCommand`, `TransferCommand` |
| Handlers | Execute commands via `@nestjs/cqrs` CommandBus |
| Aggregate | `WalletAggregate` - business logic, applies events |
| Repository | Loads aggregate by replaying events, saves new events |
| Publisher | Sends events to Query Service |

### Query Service

| Component | Purpose |
|-----------|---------|
| Projections | Event handlers that update read models |
| Read Repository | CRUD operations on read model tables |
| Controller | Responds to balance/transaction queries |

### Wallet Aggregate

Enforces business rules and produces events:

```typescript
class WalletAggregate {
  private balance: number = 0;

  deposit(amount: number) {
    if (amount <= 0) throw new Error('Amount must be positive');
    // Produces FundsDeposited event
  }

  withdraw(amount: number) {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (this.balance < amount) throw new Error('Insufficient funds');
    // Produces FundsWithdrawn event
  }

  replayEvent(event) {
    // Rebuilds state from historical events
  }
}
```

---

## Event Types

| Event | Description | Data |
|-------|-------------|------|
| WalletCreated | Wallet initialized | walletId, timestamp |
| FundsDeposited | Money added | walletId, amount, transactionId |
| FundsWithdrawn | Money removed | walletId, amount, transactionId |
| TransferInitiated | Transfer started | fromWalletId, toWalletId, amount, transactionId |
| TransferCompleted | Transfer succeeded | fromWalletId, toWalletId, amount, transactionId |
| TransferFailed | Transfer rolled back | fromWalletId, toWalletId, amount, reason, transactionId |

---

## Pending Implementations

### Transfer Failure Handling (Saga Pattern)

**Planned Approach:** Implement a saga for transfer operations.

```
1. TransferInitiated event
2. Debit source wallet → FundsWithdrawn event
3. Credit destination wallet
   - Success → TransferCompleted event
   - Failure → Compensate: Credit source wallet back → TransferFailed event
```

**Considerations:**
- Saga state tracking in database
- Compensation must be idempotent
- Handle partial failures gracefully

### Idempotency

**Planned Approach:** Client provides unique request ID in header.

```
X-Idempotency-Key: <uuid>
```

- Store processed request IDs with responses
- On duplicate request, return stored response
- TTL on idempotency records (e.g., 24 hours)

### Concurrency Control

**Planned Approach:** Optimistic locking with retry.

```typescript
// On version conflict
try {
  await saveEvent(walletId, event, expectedVersion);
} catch (VersionConflictError) {
  // Reload aggregate and retry
}
```

### Message Broker Integration

**Planned Approach:** Replace TCP with RabbitMQ.

- Durable queues for event delivery
- Dead letter queue for failed messages
- Consumer acknowledgments for at-least-once delivery

---

## Folder Structure

```
apps/
├── api-gateway/src/
│   ├── main.ts
│   ├── api-gateway.module.ts
│   └── api-gateway.controller.ts
│
├── command-service/src/
│   ├── main.ts
│   ├── command-service.module.ts
│   ├── command-service.controller.ts
│   ├── commands/
│   ├── handlers/
│   ├── aggregates/
│   ├── repositories/
│   └── publishers/
│
└── query-service/src/
    ├── main.ts
    ├── query-service.module.ts
    ├── query-service.controller.ts
    ├── projections/
    └── repositories/

libs/shared/src/
├── dto/
├── events/
├── interfaces/
├── event-store/
└── read-models/
```