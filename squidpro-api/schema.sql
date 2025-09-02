-- Core tables
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stellar_address VARCHAR(56),
    email VARCHAR(255),
    api_key VARCHAR(64) UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reviewers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stellar_address VARCHAR(56),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Data packages/products
CREATE TABLE data_packages (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    endpoint_url TEXT NOT NULL,
    price_per_query DECIMAL(10,6) DEFAULT 0.005,
    sample_data JSONB,
    schema_definition JSONB,
    rate_limit INTEGER DEFAULT 1000, -- queries per hour
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_review')),
    tags TEXT[], -- array of tags for searching
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Package usage tracking
CREATE TABLE package_usage (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES data_packages(id),
    agent_id VARCHAR(255),
    query_count INTEGER DEFAULT 0,
    last_used TIMESTAMP DEFAULT NOW(),
    total_spent DECIMAL(10,6) DEFAULT 0
);

-- Balance tracking
CREATE TABLE balances (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(20) CHECK (user_type IN ('supplier', 'reviewer', 'squidpro')),
    user_id VARCHAR(255),
    balance_usd DECIMAL(10,6) DEFAULT 0,
    pending_payout_usd DECIMAL(10,6) DEFAULT 0,
    payout_threshold_usd DECIMAL(10,2) DEFAULT 25.00,
    UNIQUE(user_type, user_id)
);

-- Transaction log
CREATE TABLE payout_history (
    id SERIAL PRIMARY KEY,
    stellar_tx_hash VARCHAR(64),
    recipient_address VARCHAR(56),
    amount_usd DECIMAL(10,6),
    user_type VARCHAR(20),
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Query/transaction history
CREATE TABLE query_history (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES data_packages(id),
    agent_id VARCHAR(255),
    query_params JSONB,
    response_size INTEGER,
    cost DECIMAL(10,6),
    trace_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert demo suppliers and reviewers with Stellar addresses
INSERT INTO suppliers (name, stellar_address, email, api_key) VALUES 
('demo_supplier', 'GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU', 'demo@cryptodata.io', 'sup_demo_12345'),
('crypto_data_co', 'GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU', 'api@cryptodata.co', 'sup_crypto_67890');

INSERT INTO reviewers (name, stellar_address) VALUES
('demo_reviewer_pool', 'GAEAQRT27B2E7Y7VZYCHZA3VAVAC34JP7M3DLRAJF5LNCFDCWP74ECH2'),
('quality_auditor_1', 'GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU');

-- Insert demo data packages
INSERT INTO data_packages (supplier_id, name, description, category, endpoint_url, price_per_query, sample_data, tags) VALUES 
(1, 'Crypto Price Feed', 'Real-time cryptocurrency prices with volume data', 'financial', 'http://collector-crypto:8200/price', 0.005, 
 '{"pair": "BTCUSDT", "price": 65000.50, "volume": 123.45, "ts": 1693123456}', 
 ARRAY['crypto', 'prices', 'real-time']),
 
(1, 'Market Sentiment Analysis', 'AI-powered sentiment analysis of crypto markets', 'financial', 'http://collector-crypto:8200/sentiment', 0.015,
 '{"symbol": "BTC", "sentiment": "bullish", "confidence": 0.85, "factors": ["social_media", "news"]}',
 ARRAY['sentiment', 'ai', 'analysis']),

(2, 'Weather Data Global', 'Current weather conditions for major cities worldwide', 'weather', 'http://weather-api:8300/current', 0.003,
 '{"city": "New York", "temp": 22.5, "humidity": 65, "conditions": "partly_cloudy"}',
 ARRAY['weather', 'global', 'current']);

-- Insert default balances with lower thresholds for demo
INSERT INTO balances (user_type, user_id, payout_threshold_usd) VALUES 
('squidpro', 'treasury', 100.00),
('supplier', '1', 0.02),  -- supplier ID instead of name
('supplier', '2', 0.02),
('reviewer', 'demo_reviewer_pool', 0.01);