# SquidPro Reviewer System Implementation

## Overview
The reviewer system creates a decentralized quality assurance layer for SquidPro's data marketplace. Reviewers earn XLM by verifying data quality, creating trust and reliability for agents purchasing data.

## Core Mechanics

### Review Types
- **Accuracy**: Compare supplier data against independent sources
- **Freshness**: Verify data recency and update frequency  
- **Schema Compliance**: Ensure data matches promised structure
- **Consensus**: Multiple reviewers assess same data package
- **Spot Audits**: Random deep-dives on specific suppliers

### Incentive Structure
- Reviewers earn from a reward pool for each task
- Consensus bonus: +20% for matching majority opinion
- Reputation multiplier: Higher-tier reviewers earn more
- Dispute penalties: Wrong assessments reduce earnings

## Database Schema

```sql
-- Review tasks - automatically generated or manually created
CREATE TABLE review_tasks (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES data_packages(id),
    task_type VARCHAR(50) CHECK (task_type IN ('accuracy', 'freshness', 'schema', 'consensus', 'spot_audit')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'expired')),
    required_reviews INTEGER DEFAULT 3,
    reward_pool_usd DECIMAL(10,6) DEFAULT 0.05,
    reference_query JSONB,
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) DEFAULT 'system'
);

-- Individual review submissions
CREATE TABLE review_submissions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES review_tasks(id),
    reviewer_id INTEGER REFERENCES reviewers(id),
    quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),
    timeliness_score INTEGER CHECK (timeliness_score BETWEEN 1 AND 10),
    schema_compliance_score INTEGER CHECK (schema_compliance_score BETWEEN 1 AND 10),
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 10),
    evidence JSONB,
    findings TEXT,
    test_timestamp TIMESTAMP,
    submitted_at TIMESTAMP DEFAULT NOW(),
    is_consensus BOOLEAN DEFAULT FALSE,
    payout_earned DECIMAL(10,6) DEFAULT 0
);

-- Package quality scores (aggregated from reviews)
CREATE TABLE package_quality_scores (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES data_packages(id) UNIQUE,
    avg_quality_score DECIMAL(3,2) DEFAULT 0,
    avg_timeliness_score DECIMAL(3,2) DEFAULT 0,
    avg_schema_score DECIMAL(3,2) DEFAULT 0,
    overall_rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    last_reviewed TIMESTAMP,
    quality_trend VARCHAR(20) DEFAULT 'stable',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Reviewer reputation and stats
CREATE TABLE reviewer_stats (
    id SERIAL PRIMARY KEY,
    reviewer_id INTEGER REFERENCES reviewers(id) UNIQUE,
    total_reviews INTEGER DEFAULT 0,
    consensus_rate DECIMAL(3,2) DEFAULT 0,
    accuracy_score DECIMAL(3,2) DEFAULT 0,
    total_earned DECIMAL(10,6) DEFAULT 0,
    avg_review_time_minutes INTEGER DEFAULT 0,
    specializations TEXT[],
    reputation_level VARCHAR(20) DEFAULT 'novice',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Reviewer disputes
CREATE TABLE review_disputes (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES review_tasks(id),
    dispute_reason TEXT,
    status VARCHAR(20) DEFAULT 'open',
    resolution_notes TEXT,
    resolved_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Add fields to existing reviewers table
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS reputation_level VARCHAR(20) DEFAULT 'novice';
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS specializations TEXT[];
ALTER TABLE reviewers ADD COLUMN IF NOT EXISTS api_key VARCHAR(64);