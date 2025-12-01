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

CREATE INDEX idx_event_store_aggregate_id ON event_store(aggregate_id);
CREATE INDEX idx_event_store_timestamp ON event_store(timestamp);

-- Transfer Saga table
CREATE TABLE IF NOT EXISTS transfer_saga (
    id VARCHAR(255) PRIMARY KEY,
    from_wallet_id VARCHAR(255) NOT NULL,
    to_wallet_id VARCHAR(255) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    debit_transaction_id VARCHAR(255),
    credit_transaction_id VARCHAR(255),
    compensation_transaction_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfer_saga_status ON transfer_saga(status);
CREATE INDEX idx_transfer_saga_from_wallet ON transfer_saga(from_wallet_id);
CREATE INDEX idx_transfer_saga_to_wallet ON transfer_saga(to_wallet_id);