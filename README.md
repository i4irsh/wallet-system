# Wallet System

An event-driven distributed Wallet Microservice built using **NestJS microservices** with **CQRS** and **Event Sourcing** patterns.

---

## Features

- **Deposit** - Add funds to a wallet
- **Withdraw** - Remove funds from a wallet
- **Transfer** - Move funds between wallets
- **Balance** - Query current wallet balance
- **History** - View transaction history
- **Auto-creation** - Wallets created automatically on first operation

---

## Documentation

- [DESIGN.md](./DESIGN.md) - Technical architecture, patterns, and implementation details

---

## Architecture Overview

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

| Service | Port | Responsibility |
|---------|------|----------------|
| API Gateway | 3000 | HTTP API, routes to internal services |
| Command Service | 3001 | Handles writes (deposit, withdraw, transfer) |
| Query Service | 3002 | Handles reads (balance, history) |
| PostgreSQL | 5432 | Event store and read models |

---

## Tech Stack

- **NestJS** - Node.js framework
- **@nestjs/cqrs** - CQRS module
- **@nestjs/microservices** - Microservice communication (TCP)
- **TypeORM** - Database ORM
- **PostgreSQL** - Database
- **Docker** - Infrastructure

---

## Project Structure

```
wallet-system/
├── apps/
│   ├── api-gateway/        # HTTP API (port 3000)
│   ├── command-service/    # Handles writes (port 3001)
│   └── query-service/      # Handles reads (port 3002)
├── libs/
│   └── shared/             # Shared DTOs, events, entities
├── docker-compose.yml
├── init.sql
└── README.md
```

---

## Prerequisites

- Node.js 18+
- npm
- Docker & Docker Compose
- NestJS CLI (`npm install -g @nestjs/cli`)

---


## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd wallet-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Creates `event_store`, `wallet_read_model`, and `transaction_read_model` tables

### 4. Verify Database

```bash
docker exec -it wallet-postgres psql -U wallet_user -d wallet_db -c "\dt"
```

Expected output:
```
              List of relations
 Schema |          Name          | Type  |    Owner
--------+------------------------+-------+-------------
 public | event_store            | table | wallet_user
 public | snapshots              | table | wallet_user
 public | transaction_read_model | table | wallet_user
 public | wallet_read_model      | table | wallet_user
```

### 5. Start Services

Open 3 terminal windows:

```bash
# Terminal 1 - Command Service
npm run start:dev command-service

# Terminal 2 - Query Service
npm run start:dev query-service

# Terminal 3 - API Gateway
npm run start:dev api-gateway
```

### 6. Verify Services

```bash
curl http://localhost:3000/wallet/ping
```

Expected output:
```json
{"commandService":"pong from command-service","queryService":"pong from query-service"}
```

---

## API Endpoints

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | /wallet/ping | Health check | - |
| POST | /wallet/deposit | Deposit money | `{ "walletId": "string", "amount": number }` |
| POST | /wallet/withdraw | Withdraw money | `{ "walletId": "string", "amount": number }` |
| POST | /wallet/transfer | Transfer money | `{ "fromWalletId": "string", "toWalletId": "string", "amount": number }` |
| GET | /wallet/balance/:walletId | Get balance | - |
| GET | /wallet/transactions/:walletId | Get history | - |

---

## Usage Examples

```bash
# Deposit
curl -X POST http://localhost:3000/wallet/deposit \
  -H "Content-Type: application/json" \
  -d '{"walletId": "wallet-123", "amount": 100}'

# Withdraw
curl -X POST http://localhost:3000/wallet/withdraw \
  -H "Content-Type: application/json" \
  -d '{"walletId": "wallet-123", "amount": 30}'

# Transfer
curl -X POST http://localhost:3000/wallet/transfer \
  -H "Content-Type: application/json" \
  -d '{"fromWalletId": "wallet-123", "toWalletId": "wallet-456", "amount": 20}'

# Get Balance
curl http://localhost:3000/wallet/balance/wallet-123

# Get Transactions
curl http://localhost:3000/wallet/transactions/wallet-123
```

---

## Database Access

```bash
# Connect to PostgreSQL
docker exec -it wallet-postgres psql -U wallet_user -d wallet_db

# View events
SELECT * FROM event_store ORDER BY id;

# View wallet balances
SELECT * FROM wallet_read_model;

# View transactions
SELECT * FROM transaction_read_model ORDER BY timestamp;
```

---

## Stopping the System

```bash
# Stop services (Ctrl+C in each terminal)

# Stop PostgreSQL
docker-compose down

# Stop and remove data
docker-compose down -v
```