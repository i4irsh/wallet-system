# Wallet System - Design Document

## Overview

A production-grade event-driven distributed Wallet Microservice implementing **CQRS** and **Event Sourcing** patterns using NestJS microservices.

---

## Design Decisions & Patterns

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

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      API GATEWAY                        │
                    |                         :3000                           │
                    └────────────────────────┬────────────────────────────────┘
                                             │
                         ┌───────────────────┴───────────────────┐
                         ▼                                       ▼
            ┌────────────────────────┐              ┌────────────────────────┐
            │     COMMAND SIDE       │              │      QUERY SIDE        │
            │   (Write Operations)   │              │   (Read Operations)    │
            ├────────────────────────┤              ├────────────────────────┤
            │                        │              │                        │
            │  • POST /deposit       │              │  • GET /balance/:id    │
            │  • POST /withdraw      │              │  • GET /transactions   │
            │  • POST /transfer      │              │                        │
            │                        │              │                        │
            │  ┌──────────────────┐  │              │  ┌──────────────────┐  │
            │  │ Command Service  │  │    Events    │  │  Query Service   │  │
            │  │    (NestJS)      │──┼─────────────►│  │    (NestJS)      │  │
            │  └────────┬─────────┘  │   RabbitMQ   │  └────────┬─────────┘  │
            │           │            │              │           │            │
            │           ▼            │              │           ▼            │
            │  ┌──────────────────┐  │              │  ┌──────────────────┐  │
            │  │   Event Store    │  │              │  │   Read Models    │  │
            │  │   (PostgreSQL)   │  │              │  │   (PostgreSQL)   │  │
            │  └──────────────────┘  │              │  └──────────────────┘  │
            │                        │              │                        │
            └────────────────────────┘              └────────────────────────┘
                    :5432                                    :5433
```

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
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         EVENT SOURCING FLOW                             │
    └─────────────────────────────────────────────────────────────────────────┘

    Command arrives          Aggregate loaded           Event generated
          │                       │                          │
          ▼                       ▼                          ▼
    ┌───────────┐      ┌──────────────────┐        ┌──────────────────┐
    │  Deposit  │      │ Replay Events    │        │ MoneyDeposited   │
    │  $100     │ ───► │ from Event Store │ ─────► │ Event Created    │
    └───────────┘      │                  │        └──────────────────┘
                       │  Event 1: +$50   │                  │
                       │  Event 2: -$20   │                  │
                       │  ─────────────   │                  ▼
                       │  Balance: $30    │        ┌──────────────────┐
                       └──────────────────┘        │ Append to        │
                                                   │ Event Store      │
                                                   │                  │
                                                   │ ┌──────────────┐ │
                                                   │ │ Event 3:     │ │
                                                   │ │ Deposit $100 │ │
                                                   │ └──────────────┘ │
                                                   └──────────────────┘
                                                            │
                                                            ▼
                                                   ┌──────────────────┐
                                                   │ Publish Event    │
                                                   │ to RabbitMQ      │
                                                   └──────────────────┘

    EVENT STORE TABLE (Append-Only Log)
    ┌────┬──────────────┬──────────────────┬─────────┬──────────────────┐
    │ ID │ aggregate_id │ event_type       │ version │ event_data       │
    ├────┼──────────────┼──────────────────┼─────────┼──────────────────┤
    │  1 │ wallet-123   │ MoneyDeposited   │    1    │ {amount: 50}     │
    │  2 │ wallet-123   │ MoneyWithdrawn   │    2    │ {amount: 20}     │
    │  3 │ wallet-123   │ MoneyDeposited   │    3    │ {amount: 100}    │
    └────┴──────────────┴──────────────────┴─────────┴──────────────────┘
                                    │
                                    ▼
                        Current Balance = $130
                        (Calculated by replaying events)
```

### 3. Microservices Architecture

**Decision:** Three separate services with RabbitMQ for async event publishing.

**Reasoning:**
- Clear separation of concerns
- Independent deployment and scaling
- Fault isolation
- Async event processing via message broker
- Separate databases for true CQRS isolation

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              WALLET MICROSERVICE SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌──────────┐                                                                      │
│   │  Client  │ ◄───────── HTTP/REST ──────────►  ┌──────────────────┐               │
│   │  (User)  │                                   │   API Gateway    │               │
│   └──────────┘                                   │     :3000        │               │
│                                                  └────────┬─────────┘               │
│                                                           │                         │
│                                           ┌───────────────┴───────────────┐         │
│                                           │           TCP                 │         │
│                                           ▼                               ▼         │
│                                ┌──────────────────┐            ┌──────────────────┐ │
│                                │ Command Service  │            │  Query Service   │ │
│                                │      :3001       │            │      :3002       │ │
│                                │                  │            │                  │ │
│                                │  ┌────────────┐  │            │  ┌────────────┐  │ │
│                                │  │ Aggregate  │  │            │  │  Consumer  │  │ │
│                                │  │ Publisher  │  │            │  │            │  │ │
│                                │  └────────────┘  │            │  └────────────┘  │ │
│                                └────────┬─────────┘            └────────▲─────────┘ │
│                                         │                               │           │
│                    ┌────────────────────┴───────────────────────────────┤           │
│                    │                    │                               │           │
│                    ▼                    ▼                               │           │
│           ┌──────────────┐    ┌──────────────────────────────┐          │           │
│           │   Write DB   │    │         RabbitMQ             │          │           │
│           │ (Event Store)│    │          :5672               │──────────┘           │
│           │    :5432     │    │                              │                      │
│           └──────────────┘    │  ┌──────────┐  ┌──────────┐  │    ┌──────────────┐  │
│                               │  │ Exchange │─►│  Queue   │  │    │   Read DB    │  │
│                               │  └──────────┘  └──────────┘  │    │(Projections) │  │
│                               │                ┌──────────┐  │    │    :5433     │  │
│                               │                │   DLQ    │  │    └──────────────┘  │
│                               │                └──────────┘  │                      │
│                               └──────────────────────────────┘                      │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 4. PostgreSQL as Event Store

**Decision:** Use PostgreSQL with JSONB for event storage instead of a dedicated event store.

**Reasoning:**
- Simpler infrastructure
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

### 6. RabbitMQ as Message Broker

**Decision:** Use RabbitMQ for async event publishing between services.

**Reasoning:**
- Durable message persistence
- At-least-once delivery with consumer acknowledgments
- Dead letter queue for failed message inspection
- Topic routing for flexible event subscription
- Management UI for monitoring


```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              RABBITMQ                                            │
│                               :5672                                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     Command Service                                      Query Service           │
│           │                                                    ▲                 │
│           │ publish()                                          │ consume()       │
│           ▼                                                    │                 │
│   ┌───────────────────────────────────────────────────────────────────────┐      │
│   │                                                                       │      │
│   │  ┌──────────────────────┐         ┌──────────────────────┐            │      │
│   │  │  TOPIC EXCHANGE      │         │  MAIN QUEUE          │            │      │
│   │  │  wallet.events       │ ──────► │  wallet.events.queue │────────────┼──►   │
│   │  │                      │         │                      │            │      │
│   │  │  Routing Keys:       │         │  Binding: wallet.#   │            │      │
│   │  │  • wallet.money.*    │         │                      │            │      │
│   │  └──────────────────────┘         └──────────┬───────────┘            │      │
│   │                                              │                        │      │
│   │                                   ┌──────────▼───────────┐            │      │
│   │                                   │  DEAD LETTER QUEUE   │            │      │
│   │                                   │  wallet.events.dlq   │            │      │
│   │                                   │                      │            │      │
│   │                                   │  (Failed messages)   │            │      │
│   │                                   └──────────────────────┘            │      │
│   │                                                                       │      │
│   └───────────────────────────────────────────────────────────────────────┘      │
│                                                                                  │
│   ROUTING KEYS                        MESSAGE FORMAT                             │
│   ─────────────                       ──────────────                             │
│   • wallet.money.deposited            {                                          │
│   • wallet.money.withdrawn              eventType: "MoneyDepositedEvent",        │
│   • wallet.money.transferred            data: {                                  │
│                                           walletId: "...",                       │
│                                           amount: 100,                           │
│                                           balanceAfter: 150,                     │
│                                           transactionId: "...",                  │
│                                           timestamp: "..."                       │
│                                         },                                       │
│                                         publishedAt: "..."                       │
│                                       }                                          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 7. Transfer Saga Pattern

The transfer operation implements the **Saga Pattern** to handle distributed transactions across two wallets with automatic compensation on failure.

### Saga State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           TRANSFER SAGA STATE MACHINE                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌───────────┐      Saga Created       ┌────────────────┐
    │  START    │ ───────────────────────►│   INITIATED    │
    └───────────┘                         └───────┬────────┘
                                                  │
                                          Debit Source Wallet
                                                  │
                              ┌───────────────────┴───────────────────┐
                              │                                       │
                         Success                                  Failure
                              │                                       │
                              ▼                                       ▼
                   ┌──────────────────┐                     ┌─────────────────┐
                   │  SOURCE_DEBITED  │                     │     FAILED      │
                   └────────┬─────────┘                     │  (No refund     │
                            │                               │   needed)       │
                    Credit Destination                      └─────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
       Success                          Failure
            │                               │
            ▼                               ▼
  ┌─────────────────┐             ┌─────────────────┐
  │    COMPLETED    │             │   COMPENSATING  │
  │                 │             │                 │
  │  Both wallets   │             │  Refund source  │
  │  updated        │             │  wallet         │
  └─────────────────┘             └────────┬────────┘
                                           │
                                   Compensation Result
                                           │
                               ┌───────────┴───────────┐
                               │                       │
                           Success                 Failure
                               │                       │
                               ▼                       ▼
                     ┌─────────────────┐    ┌──────────────────────┐
                     │     FAILED      │    │     COMPENSATING     │
                     │                 │    │                      │
                     │  Funds refunded │    │  CRITICAL: Manual    │
                     │  to source      │    │  intervention needed │
                     └─────────────────┘    └──────────────────────┘
```

### Saga Status States

| Status | Description |
|--------|-------------|
| `INITIATED` | Transfer saga created, about to debit source wallet |
| `SOURCE_DEBITED` | Source wallet debited successfully, about to credit destination |
| `COMPLETED` | Transfer completed successfully |
| `COMPENSATING` | Credit failed, attempting to refund source wallet |
| `FAILED` | Transfer failed (with or without compensation) |


---

## Data Flow

### Write Path (Synchronous Response)

```
1. Client sends POST /wallet/:id/deposit
2. API Gateway forwards to Command Service (TCP)
3. Command Service:
   a. Loads wallet aggregate (replays events from Write DB)
   b. Validates business rules
   c. Produces event (MoneyDepositedEvent)
   d. Saves event to event_store (Write DB :5432)
   e. Publishes event to RabbitMQ (wallet.events exchange)
4. Client receives immediate response
5. Background: Query Service WalletEventConsumer:
   a. Consumes event from wallet.events.queue
   b. Updates read models (Read DB :5433)
   c. ACKs message on success, NACKs to DLQ on failure
```

### Read Path

```
1. Client sends GET /wallet/:id
2. API Gateway forwards to Query Service (TCP)
3. Query Service reads from wallet_read_model (Read DB :5433)
4. Client receives response
```

---

## Database Schema

### Write Database for Event Store (postgres-write:5432)

**Event Store:**
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

**Transfer Saga:**
```sql
transfer_saga (
  id                          VARCHAR(255) PRIMARY KEY,
  from_wallet_id              VARCHAR(255) NOT NULL,
  to_wallet_id                VARCHAR(255) NOT NULL,
  amount                      DECIMAL(18, 2) NOT NULL,
  status                      VARCHAR(50) NOT NULL,
  debit_transaction_id        VARCHAR(255),      -- Transaction ID from source debit
  credit_transaction_id       VARCHAR(255),      -- Transaction ID from destination credit
  compensation_transaction_id VARCHAR(255),      -- Transaction ID from refund (if any)
  error_message               TEXT,              -- Error details if failed
  created_at                  TIMESTAMPTZ,
  updated_at                  TIMESTAMPTZ
)
```

### Read Database (postgres-read:5433)

**Wallet Balance Projection:**
```sql
wallet_read_model (
  id         VARCHAR(255) PRIMARY KEY,
  balance    DECIMAL(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Transaction History Projection:**
```sql
transaction_read_model (
  id                VARCHAR(255) PRIMARY KEY,
  wallet_id         VARCHAR(255),
  type              VARCHAR(50),    -- DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT
  amount            DECIMAL(18,2),
  balance_after     DECIMAL(18,2),
  related_wallet_id VARCHAR(255),   -- for transfers
  timestamp         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ
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
| Publisher | Sends events to Query Service via RabbitMQ |
| TransferSagaService | Orchestrates transfer saga with compensation |


### Query Service

| Component | Purpose |
|-----------|---------|
| WalletEventConsumer | Consumes events from RabbitMQ, updates read models |
| Read Repository | CRUD operations on read model tables |
| Controller | Responds to balance/transaction queries |

---

## Event Types

### Wallet Events

| Event | Description | Data |
|-------|-------------|------|
| MoneyDeposited | Money added to wallet | walletId, amount, transactionId, timestamp |
| MoneyWithdrawn | Money removed from wallet | walletId, amount, transactionId, timestamp |
| MoneyTransferred | Transfer completed (legacy) | fromWalletId, toWalletId, amount, transactionId, timestamp |

### Transfer Saga Events

| Event | Description | Data |
|-------|-------------|------|
| TransferInitiated | Saga started | sagaId, fromWalletId, toWalletId, amount, timestamp |
| SourceWalletDebited | Source wallet debited | sagaId, walletId, amount, transactionId, timestamp |
| DestinationWalletCredited | Destination wallet credited | sagaId, walletId, amount, transactionId, timestamp |
| TransferCompleted | Transfer succeeded | sagaId, fromWalletId, toWalletId, amount, timestamp |
| CompensationInitiated | Compensation started | sagaId, walletId, amount, reason, timestamp |
| SourceWalletRefunded | Source wallet refunded | sagaId, walletId, amount, transactionId, timestamp |
| TransferFailed | Transfer failed | sagaId, fromWalletId, toWalletId, amount, reason, timestamp |


---

## Project Structure

```
wallet-system/
├── apps/
│   ├── api-gateway/        # HTTP API (port 3000)
│   ├── command-service/    # Handles writes (port 3001)
│   │   ├── publishers/     # RabbitMQ event publishers
│   │   └── sagas/          # Saga orchestrators
│   └── query-service/      # Handles reads (port 3002)
│       └── consumers/      # RabbitMQ event consumers
├── libs/
│   └── shared/
│       ├── dto/            # Data transfer objects
│       ├── events/         # Event definitions (including saga events)
│       ├── event-store/    # Event store entity & service
│       ├── rabbitmq/       # RabbitMQ module & service
│       ├── read-models/    # Read model entities
│       └── saga/           # Saga entities
├── docker-compose.yml
├── init-write.sql          # Event store + saga schema
├── init-read.sql           # Read model schema
└── README.md
```

---

## Implementation Status

### ✅ Completed

| Requirement | Status | Details |
|-------------|--------|---------|
| Core API Endpoints | ✅ | Deposit, Withdraw, Transfer, Get Balance, Get History |
| Event Recording | ✅ | All operations stored as immutable events in `event_store` table |
| Event Publishing | ✅ | Events published via RabbitMQ message broker |
| Audit Trail | ✅ | Complete event history with timestamps and transaction IDs |
| Read/Write Separation | ✅ | Command service (writes) and Query service (reads) |
| Read Model Projections | ✅ | wallet_read_model and transaction_read_model tables |
| Separate Databases | ✅ | Write DB (5432) and Read DB (5433) |
| Message Broker | ✅ | RabbitMQ with topic exchange for event routing |
| Dead Letter Queue | ✅ | Failed messages routed to wallet.events.dlq |
| Transfer Saga | ✅ | Saga pattern with compensation for distributed transfer transactions |

### ⏳ Pending

| Requirement | Status | Notes |
|-------------|--------|-------|
| Async Background Worker | ⏳ | Need separate consumer service with business logic |
| Idempotency | ⏳ | Need request ID tracking for duplicate detection |
| Snapshots | ⏳ | Need snapshot table for aggregate performance |
| Test Suite | ⏳ | Need comprehensive tests |
| Configuration | ⏳ | Need centralized config management |
| Validation | ⏳ | Need input validation on DTOs |

