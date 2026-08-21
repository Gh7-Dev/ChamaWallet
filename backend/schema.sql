-- ChamaVault Phase 1 Database Schema
-- Designed for PostgreSQL

-- Drop tables if they exist
DROP TABLE IF EXISTS reconciliation_logs CASCADE;
DROP TABLE IF EXISTS transaction_logs CASCADE;
DROP TABLE IF EXISTS chama_floats CASCADE;

-- 1. Chama Floats table to track the operational gas contribution pools (OPEX_FLOAT)
CREATE TABLE chama_floats (
    chama_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    opex_float DECIMAL(18, 4) NOT NULL DEFAULT 1000.0000, -- Initialize with 1000 KES float as default
    status VARCHAR(50) NOT NULL DEFAULT 'Normal', -- 'Normal', 'Warning', 'Locked'
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast status querying
CREATE INDEX idx_chama_floats_status ON chama_floats(status);

-- 2. Transaction logs to record transaction details, fee consumption, and rate limits
CREATE TABLE transaction_logs (
    id SERIAL PRIMARY KEY,
    chama_id VARCHAR(100) NOT NULL REFERENCES chama_floats(chama_id) ON DELETE CASCADE,
    member_address VARCHAR(100) NOT NULL,
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    function_name VARCHAR(100) NOT NULL,
    fee_stroops BIGINT NOT NULL,
    fee_xlm DECIMAL(18, 7) NOT NULL,
    fee_kes DECIMAL(18, 4) NOT NULL, -- Estimated KES equivalent of the fee paid by relayer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for daily rate-limiting and query optimization
CREATE INDEX idx_tx_logs_member_time ON transaction_logs(member_address, created_at);
CREATE INDEX idx_tx_logs_chama_time ON transaction_logs(chama_id, created_at);
CREATE INDEX idx_tx_logs_created_at ON transaction_logs(created_at);

-- 3. Reconciliation logs to track automated 30-day audits
CREATE TABLE reconciliation_logs (
    id SERIAL PRIMARY KEY,
    chama_id VARCHAR(100) NOT NULL REFERENCES chama_floats(chama_id) ON DELETE CASCADE,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_usage_xlm DECIMAL(18, 7) NOT NULL,
    total_usage_kes DECIMAL(18, 4) NOT NULL,
    total_contributions_kes DECIMAL(18, 4) NOT NULL,
    reconciled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reconciliation_logs_chama_id ON reconciliation_logs(chama_id);
