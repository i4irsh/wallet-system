-- Fraud Detection Database Schema

-- Risk level enum type
CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Alert severity enum type
CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Risk profiles table
CREATE TABLE risk_profiles (
    wallet_id VARCHAR(255) PRIMARY KEY,
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level risk_level NOT NULL DEFAULT 'LOW',
    alert_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id VARCHAR(255) NOT NULL,
    rule_id VARCHAR(255) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    severity alert_severity NOT NULL,
    transaction_id VARCHAR(255),
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Recent events table (for velocity and pattern checks)
CREATE TABLE recent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2),
    transaction_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX idx_alerts_wallet_id ON alerts(wallet_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_risk_profiles_risk_level ON risk_profiles(risk_level);
CREATE INDEX idx_risk_profiles_risk_score ON risk_profiles(risk_score);
CREATE INDEX idx_recent_events_wallet_id ON recent_events(wallet_id);
CREATE INDEX idx_recent_events_created_at ON recent_events(created_at);
CREATE INDEX idx_recent_events_event_type ON recent_events(event_type);

