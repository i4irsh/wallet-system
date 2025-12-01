-- Event Store table
CREATE TABLE IF NOT EXISTS event_store (
    id SERIAL PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    version INT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    transaction_id VARCHAR(255),
    UNIQUE(aggregate_id, version)
);

-- Index for faster aggregate lookups
CREATE INDEX idx_event_store_aggregate_id ON event_store(aggregate_id);
CREATE INDEX idx_event_store_aggregate_type ON event_store(aggregate_type);
CREATE INDEX idx_event_store_timestamp ON event_store(timestamp);


-- READ MODEL: Wallet balances (for query service)
CREATE TABLE IF NOT EXISTS wallet_read_model (
    id VARCHAR(255) PRIMARY KEY,
    balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- READ MODEL: Transaction history (for query service)
CREATE TABLE IF NOT EXISTS transaction_read_model (
    id VARCHAR(255) PRIMARY KEY,
    wallet_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    balance_after DECIMAL(18, 2) NOT NULL,
    related_wallet_id VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaction_wallet_id ON transaction_read_model(wallet_id);
CREATE INDEX idx_transaction_timestamp ON transaction_read_model(timestamp);