# SquidPro Reviewer System Testing Guide

## Setup Steps

### 1. Update Database Schema
First, add the reviewer tables to your database:

```bash
# Connect to your PostgreSQL container
docker exec -it squidpro-postgres-1 psql -U squidpro -d squidpro

# Copy and paste the SQL from docs/reviewer-system.md
# Or create a migration file:
```

Create `squidpro-api/migrations/002_reviewer_system.sql`:
```sql
-- Copy the SQL schema from docs/reviewer-system.md here
-- All the CREATE TABLE statements for review_tasks, review_submissions, etc.
```

### 2. Add Code to API
Copy the Python code from `docs/reviewer-endpoints.py` and add it to `squidpro-api/app.py`:

```python
# Add these imports at the top
import secrets
import statistics

# Add the Pydantic models after existing models
class ReviewerRegistration(BaseModel):
    # ... copy from reviewer-endpoints.py

# Add all the endpoint functions
@api.post("/reviewers/register")
async def register_reviewer(reviewer: ReviewerRegistration):
    # ... copy from reviewer-endpoints.py
```

### 3. Rebuild and Start
```bash
docker compose down
docker compose up --build
```

## Testing Workflow

### Step 1: Register a Reviewer
```bash
curl -X POST http://localhost:8100/reviewers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Quality",
    "stellar_address": "GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU",
    "email": "alice@example.com",
    "specializations": ["financial", "crypto"]
  }' | jq
```

**Expected Response:**
```json
{
  "reviewer_id": 1,
  "api_key": "rev_abc123def456...",
  "status": "registered",
  "message": "Reviewer registered successfully. Save your API key securely."
}
```

**Save the API key!** You'll need it for the next steps.

### Step 2: Check Reviewer Info
```bash
curl -H "X-API-Key: rev_abc123def456..." \
  http://localhost:8100/reviewers/me | jq
```

**Expected Response:**
```json
{
  "id": 1,
  "name": "Alice Quality",
  "stellar_address": "GDXD...",
  "reputation_level": "novice",
  "specializations": ["financial", "crypto"],
  "stats": {
    "total_reviews": 0,
    "consensus_rate": 0,
    "accuracy_score": 0,
    "total_earned": 0,
    "avg_review_time_minutes": 0
  },
  "balance": 0,
  "payout_threshold": 5.00
}
```

### Step 3: Create a Review Task (Admin)
```bash
curl -X POST "http://localhost:8100/admin/create-review-task?package_id=1&task_type=accuracy&reward_pool=0.10&required_reviews=2" | jq
```

**Expected Response:**
```json
{
  "task_id": 1,
  "status": "created",
  "package": "Crypto Price Feed",
  "reward_pool": 0.10
}
```

### Step 4: Get Available Review Tasks
```bash
curl -H "X-API-Key: rev_abc123def456..." \
  http://localhost:8100/review-tasks | jq
```

**Expected Response:**
```json
[
  {
    "task_id": 1,
    "package_name": "Crypto Price Feed",
    "supplier": "demo_supplier",
    "category": "financial",
    "task_type": "accuracy",
    "reward_pool": 0.10,
    "spots_remaining": 2,
    "current_rating": 0,
    "reference_query": {
      "endpoint": "http://collector-crypto:8200/price",
      "task_type": "accuracy",
      "package_category": "financial"
    },
    "expires_at": "2025-09-03T14:30:00Z"
  }
]
```

### Step 5: Submit a Review
```bash
curl -X POST http://localhost:8100/review-tasks/1/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rev_abc123def456..." \
  -d '{
    "quality_score": 8,
    "timeliness_score": 9,
    "schema_compliance_score": 10,
    "overall_rating": 9,
    "findings": "Data looks accurate. Tested against CoinGecko and Binance APIs. Price variance within acceptable range (<$10). Schema matches exactly. Response time under 100ms.",
    "evidence": {
      "test_timestamp": "2025-09-02T14:30:00Z",
      "reference_sources": [
        {"source": "CoinGecko", "btc_price": 65000.50},
        {"source": "Binance", "btc_price": 65001.20}
      ],
      "supplier_data": {"btc_price": 65000.75},
      "variance_analysis": {
        "vs_coingecko": 0.25,
        "vs_binance": -0.45,
        "avg_deviation": 0.35
      }
    }
  }' | jq
```

**Expected Response:**
```json
{
  "submission_id": 1,
  "status": "submitted",
  "task_name": "Crypto Price Feed",
  "message": "Review submitted. 1 more reviews needed for consensus."
}
```

### Step 6: Register Second Reviewer and Submit Review
```bash
# Register second reviewer
curl -X POST http://localhost:8100/reviewers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Validator",
    "stellar_address": "GAEAQRT27B2E7Y7VZYCHZA3VAVAC34JP7M3DLRAJF5LNCFDCWP74ECH2",
    "specializations": ["financial"]
  }' | jq

# Submit second review (use the new API key)
curl -X POST http://localhost:8100/review-tasks/1/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rev_xyz789..." \
  -d '{
    "quality_score": 7,
    "timeliness_score": 8,
    "schema_compliance_score": 10,
    "overall_rating": 8,
    "findings": "Good data quality overall. Minor delay in updates but within acceptable range. Schema perfect.",
    "evidence": {
      "test_timestamp": "2025-09-02T14:35:00Z",
      "supplier_data": {"btc_price": 65002.10}
    }
  }' | jq
```

### Step 7: Check Updated Balances
```bash
# Check first reviewer's balance (should have earnings now)
curl -H "X-API-Key: rev_abc123def456..." \
  http://localhost:8100/reviewers/me | jq

# Check all balances
curl http://localhost:8100/balances | jq
```

**Expected:** Both reviewers should now have earned money, with the consensus bonus applied.

### Step 8: Check Package Quality Scores
```bash
curl http://localhost:8100/packages/1/quality | jq
```

**Expected Response:**
```json
{
  "package_id": 1,
  "package_name": "Crypto Price Feed",
  "supplier": "demo_supplier",
  "scores": {
    "overall_rating": 8.5,
    "quality": 7.5,
    "timeliness": 8.5,
    "schema_compliance": 10.0
  },
  "total_reviews": 2,
  "last_reviewed": "2025-09-02T14:35:00Z",
  "trend": "stable",
  "recent_reviews": [
    {
      "rating": 8,
      "reviewer": "Bob Validator",
      "findings": "Good data quality overall. Minor delay in updates but within acceptable range. Schema perfect.",
      "date": "2025-09-02T14:35:00Z"
    },
    {
      "rating": 9,
      "reviewer": "Alice Quality",
      "findings": "Data looks accurate. Tested against CoinGecko and Binance APIs. Price variance within acceptable range (<$10). Schema matches exactly. Response time under 100ms.",
      "date": "2025-09-02T14:30:00Z"
    }
  ]
}
```

## Verification Checklist

### Database Checks
```sql
-- Connect to database
docker exec -it squidpro-postgres-1 psql -U squidpro -d squidpro

-- Check reviewers were created
SELECT * FROM reviewers;

-- Check review task was created and completed
SELECT * FROM review_tasks;

-- Check review submissions
SELECT * FROM review_submissions;

-- Check updated balances
SELECT * FROM balances WHERE user_type = 'reviewer';

-- Check package quality scores
SELECT * FROM package_quality_scores;

-- Check reviewer stats
SELECT * FROM reviewer_stats;
```

### API Health Checks
```bash
# Check all endpoints are working
curl http://localhost:8100/health
curl http://localhost:8100/balances
curl http://localhost:8100/packages
```

## Testing Edge Cases

### Test Duplicate Review Prevention
```bash
# Try to submit same review twice (should fail)
curl -X POST http://localhost:8100/review-tasks/1/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rev_abc123def456..." \
  -d '{"quality_score": 5, "timeliness_score": 5, "schema_compliance_score": 5, "overall_rating": 5, "findings": "duplicate test"}'
```

**Expected:** HTTP 409 error "Already submitted review for this task"

### Test Invalid API Key
```bash
curl -H "X-API-Key: invalid_key" \
  http://localhost:8100/reviewers/me
```

**Expected:** HTTP 401 error "Invalid reviewer API key"

### Test Task Expiration
Create a task, wait for it to expire, then try to submit a review.

## Performance Testing

### Load Test Review Submissions
```bash
# Create multiple review tasks
for i in {1..5}; do
  curl -X POST "http://localhost:8100/admin/create-review-task?package_id=1&task_type=accuracy&reward_pool=0.05"
done

# Register multiple reviewers and submit reviews concurrently
# (Use a tool like Apache Bench or write a script)
```

## Integration Testing

### Test Full Agent → Review → Quality Flow
```bash
# 1. Agent buys data
curl -X POST http://localhost:8100/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test_agent","credits":1.0}' | jq

# 2. Agent queries data (creates usage)
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:8100/data/price?pair=BTCUSDT" | jq

# 3. Create review task for that package
curl -X POST "http://localhost:8100/admin/create-review-task?package_id=1&task_type=accuracy"

# 4. Reviewers assess quality
# (Submit reviews as shown above)

# 5. Agent can now see quality scores before buying
curl http://localhost:8100/packages/1/quality | jq
```

## Troubleshooting

### Common Issues

**Error: "relation 'review_tasks' does not exist"**
- Solution: Run the database migration SQL first

**Error: "Invalid reviewer API key"**  
- Solution: Make sure you're using the correct API key from registration

**Error: "Task not found or expired"**
- Solution: Check if the task exists and hasn't expired (24 hours)

**No earnings showing up**
- Solution: Need at least 2 reviewers to trigger consensus processing

### Debug Queries
```sql
-- Check if consensus was calculated
SELECT * FROM review_submissions WHERE is_consensus IS NOT NULL;

-- Check balance updates
SELECT * FROM balances WHERE user_type = 'reviewer' AND balance_usd > 0;

-- Check task completion
SELECT status FROM review_tasks WHERE id = 1;
```

This testing guide ensures your reviewer system works correctly end-to-end!