-- Wallet balance projection
CREATE TABLE IF NOT EXISTS wallet_read_model (
    id VARCHAR(255) PRIMARY KEY,
    balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction history projection
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