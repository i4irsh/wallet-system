# Wallet System

An event-driven distributed Wallet Microservice built using **NestJS microservices** with **CQRS** and **Event Sourcing** patterns.

---

## Features

- **Deposit** - Add funds to a wallet
- **Withdraw** - Remove funds from a wallet
- **Transfer** - Move funds between wallets
- **Balance** - Query current wallet balance
- **History** - View transaction history

---

## Technical Documentation

- [DESIGN.md](./DESIGN.md) - Technical architecture, patterns, and implementation details

---


## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | NestJS |
| Message Broker | RabbitMQ 3.13 |
| Database | PostgreSQL 16 |
| ORM | TypeORM |
| CQRS | @nestjs/cqrs |
| Language | TypeScript |
| Container | Docker Compose |


---

## Prerequisites

- Node.js 18+
- Docker & Docker Compose

---


## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/i4irsh/wallet-system.git
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
- PostgreSQL (Write) on port 5432 - Event store database
- PostgreSQL (Read) on port 5433 - Read model projections database
- RabbitMQ on port 5672 (AMQP) and 15672 (Management UI)

**RabbitMQ Management UI:**
Open http://localhost:15672 (credentials: wallet_user / wallet_password)

### 4. Start Services

Open 3 terminal windows:

```bash
# Terminal 1 - Command Service
npm run start:dev command-service

# Terminal 2 - Query Service
npm run start:dev query-service

# Terminal 3 - API Gateway
npm run start:dev api-gateway
```

### 5. Verify Services

```bash
curl http://localhost:3000/wallet/ping
```

Expected output:
```json
{"commandService":"pong from command-service","queryService":"pong from query-service"}
```

---

## API Reference

| Method | Endpoint | Service | Description |
|--------|----------|---------|-------------|
| POST | `/deposit` | Command | Deposit funds to wallet |
| POST | `/withdraw` | Command | Withdraw funds from wallet |
| POST | `/transfer` | Command | Transfer between wallets |
| GET | `/balance/:walletId` | Query | Get current wallet balance |
| GET | `/transactions/:walletId` | Query | Get transaction history |
| GET | `/ping` | Both | Health check both services |

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
# Connect to Write Database (Event Store)
docker exec -it wallet-postgres-write psql -U wallet_user -d wallet_write_db

# View events
SELECT * FROM event_store ORDER BY id;
```

```bash
# Connect to Read Database (Projections)
docker exec -it wallet-postgres-read psql -U wallet_user -d wallet_read_db

# View wallet balances
SELECT * FROM wallet_read_model;

# View transactions
SELECT * FROM transaction_read_model ORDER BY timestamp;
```

---

## Stopping the System

```bash
# Stop services (Ctrl+C in each terminal)

# Stop infrastructure (PostgreSQL + RabbitMQ)
docker-compose down

# Stop and remove all data (databases + message queues)
docker-compose down -v
```