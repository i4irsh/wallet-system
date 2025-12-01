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