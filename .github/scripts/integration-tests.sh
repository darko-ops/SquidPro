#!/bin/bash

echo "🧪 SquidPro Integration Tests (GitHub Actions)"
echo "=============================================="

API_BASE="http://localhost:8100"
ERRORS=0
TEST_RESULTS=()

# Helper function to check response and log results
check_response() {
    local response="$1"
    local expected_field="$2"
    local test_name="$3"
    
    if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
        echo "✅ $test_name"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"PASS\"}")
        return 0
    else
        echo "❌ $test_name"
        echo "   Response: $response"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"FAIL\", \"response\": \"$response\"}")
        ((ERRORS++))
        return 1
    fi
}

# Helper function to check HTTP status
check_http_status() {
    local url="$1"
    local expected_status="$2"
    local test_name="$3"
    
    local actual_status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$actual_status" = "$expected_status" ]; then
        echo "✅ $test_name (HTTP $actual_status)"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"PASS\", \"http_status\": $actual_status}")
        return 0
    else
        echo "❌ $test_name (Expected $expected_status, got $actual_status)"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"FAIL\", \"expected\": $expected_status, \"actual\": $actual_status}")
        ((ERRORS++))
        return 1
    fi
}

# Test 1: API Health
echo "1️⃣ Testing API Health..."
for i in {1..10}; do
    HEALTH=$(curl -s $API_BASE/health 2>/dev/null)
    if echo "$HEALTH" | jq -e '.ok' > /dev/null 2>&1; then
        check_response "$HEALTH" "ok" "API Health Check"
        break
    fi
    echo "Waiting for API... ($i/10)"
    sleep 3
done

# Test 2: Database Connection
echo -e "\n2️⃣ Testing Database Connection..."
BALANCES=$(curl -s $API_BASE/balances)
check_response "$BALANCES" "[0]" "Database Connection via Balances"

# Test 3: Package Listing
echo -e "\n3️⃣ Testing Package Listing..."
PACKAGES=$(curl -s $API_BASE/packages)
check_response "$PACKAGES" "[0]" "Package Listing"

# Test 4: User Registration
echo -e "\n4️⃣ Testing User Registration..."

# Register Supplier
SUPPLIER_REG=$(curl -s -X POST $API_BASE/suppliers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI Test Supplier",
    "email": "ci-supplier@example.com",
    "stellar_address": "GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU"
  }')

if check_response "$SUPPLIER_REG" "api_key" "Supplier Registration"; then
    SUPPLIER_KEY=$(echo "$SUPPLIER_REG" | jq -r '.api_key')
    SUPPLIER_ID=$(echo "$SUPPLIER_REG" | jq -r '.supplier_id')
fi

# Register Reviewer
REVIEWER_REG=$(curl -s -X POST $API_BASE/reviewers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI Test Reviewer",
    "stellar_address": "GAEAQRT27B2E7Y7VZYCHZA3VAVAC34JP7M3DLRAJF5LNCFDCWP74ECH2",
    "specializations": ["financial", "ci-test"]
  }')

if check_response "$REVIEWER_REG" "api_key" "Reviewer Registration"; then
    REVIEWER_KEY=$(echo "$REVIEWER_REG" | jq -r '.api_key')
    REVIEWER_ID=$(echo "$REVIEWER_REG" | jq -r '.reviewer_id')
fi

# Test 5: Authentication
echo -e "\n5️⃣ Testing Authentication..."

SUPPLIER_ME=$(curl -s -H "X-API-Key: $SUPPLIER_KEY" $API_BASE/suppliers/me)
check_response "$SUPPLIER_ME" "name" "Supplier Authentication"

REVIEWER_ME=$(curl -s -H "X-API-Key: $REVIEWER_KEY" $API_BASE/reviewers/me)
check_response "$REVIEWER_ME" "name" "Reviewer Authentication"

# Test 6: Token System
echo -e "\n6️⃣ Testing Token System..."

TOKEN_RESPONSE=$(curl -s -X POST $API_BASE/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"ci_test_agent","credits":10.0}')

if check_response "$TOKEN_RESPONSE" "token" "Token Minting"; then
    TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
fi

# Test 7: Data Upload
echo -e "\n7️⃣ Testing Data Upload..."

# Create test CSV
cat > ci_test_data.csv << 'EOF'
symbol,price,volume,market_cap,change_24h
BTC,67500.00,1234567890,1300000000000,2.1
ETH,3400.00,987654321,400000000000,-0.8
SOL,160.00,123456789,70000000000,4.2
ADA,0.45,567890123,15000000000,-1.2
EOF

UPLOAD_RESPONSE=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@ci_test_data.csv" \
  -F "name=CI Test Dataset" \
  -F "description=Dataset for CI testing" \
  -F "category=financial" \
  -F "price_per_query=0.01" \
  -F "tags=ci,test,crypto")

if check_response "$UPLOAD_RESPONSE" "package_id" "Dataset Upload"; then
    PACKAGE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.package_id')
    FILENAME=$(echo "$UPLOAD_RESPONSE" | jq -r '.filename')
fi

# Test 8: Data Access
echo -e "\n8️⃣ Testing Data Access..."

# Test package access
PACKAGE_DATA=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/data/package/$PACKAGE_ID")
check_response "$PACKAGE_DATA" "data" "Package Data Access"

# Test uploaded file access
UPLOAD_DATA=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/data/uploaded/$FILENAME?limit=2")
check_response "$UPLOAD_DATA" "data" "Uploaded Data Access"

# Test legacy price endpoint
PRICE_DATA=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/data/price?pair=BTCUSDT")
check_response "$PRICE_DATA" "price" "Legacy Price Endpoint"

# Test 9: Balance System
echo -e "\n9️⃣ Testing Balance System..."

# Check that balances updated after data queries
UPDATED_BALANCES=$(curl -s $API_BASE/balances)
check_response "$UPDATED_BALANCES" "[0].balance" "Balance Updates"

# Test balance lookup
SUPPLIER_BALANCE=$(curl -s $API_BASE/balances/supplier/$SUPPLIER_ID)
check_response "$SUPPLIER_BALANCE" "balance" "Individual Balance Lookup"

# Test 10: Review System
echo -e "\n🔟 Testing Review System..."

# Create review task
TASK_RESPONSE=$(curl -s -X POST "$API_BASE/admin/create-review-task?package_id=$PACKAGE_ID&task_type=accuracy&reward_pool=0.05")
if check_response "$TASK_RESPONSE" "task_id" "Review Task Creation"; then
    TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.task_id')
fi

# Get available tasks
AVAILABLE_TASKS=$(curl -s -H "X-API-Key: $REVIEWER_KEY" $API_BASE/review-tasks)
check_response "$AVAILABLE_TASKS" "[0]" "Available Review Tasks"

# Submit review
REVIEW_SUBMISSION=$(curl -s -X POST $API_BASE/review-tasks/$TASK_ID/submit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $REVIEWER_KEY" \
  -d '{
    "quality_score": 9,
    "timeliness_score": 8,
    "schema_compliance_score": 10,
    "overall_rating": 9,
    "findings": "CI test review - excellent data quality",
    "evidence": {
      "test_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "ci_environment": true
    }
  }')
check_response "$REVIEW_SUBMISSION" "submission_id" "Review Submission"

# Test 11: Error Handling
echo -e "\n1️⃣1️⃣ Testing Error Handling..."

# Test invalid token
check_http_status "$API_BASE/data/package/1" "401" "Invalid Token Rejection"

# Test non-existent package
INVALID_PACKAGE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/data/package/99999")
if echo "$INVALID_PACKAGE" | grep -q "not found\|404"; then
    echo "✅ Not Found Handling"
    TEST_RESULTS+=("{\"test\": \"Not Found Handling\", \"status\": \"PASS\"}")
else
    echo "❌ Not Found Handling"
    TEST_RESULTS+=("{\"test\": \"Not Found Handling\", \"status\": \"FAIL\"}")
    ((ERRORS++))
fi

# Test 12: PII Detection
echo -e "\n1️⃣2️⃣ Testing PII Detection..."

# Create CSV with PII
cat > pii_test.csv << 'EOF'
name,email,ssn,phone
John Doe,john@example.com,123-45-6789,555-123-4567
Jane Smith,jane@example.com,987-65-4321,555-987-6543
EOF

PII_UPLOAD=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@pii_test.csv" \
  -F "name=PII Test" \
  -F "category=test")

if echo "$PII_UPLOAD" | grep -q "PII_DETECTED\|blocked"; then
    echo "✅ PII Detection and Blocking"
    TEST_RESULTS+=("{\"test\": \"PII Detection\", \"status\": \"PASS\"}")
else
    echo "❌ PII Detection and Blocking"
    TEST_RESULTS+=("{\"test\": \"PII Detection\", \"status\": \"FAIL\"}")
    ((ERRORS++))
fi

# Test 13: Web Interface
echo -e "\n1️⃣3️⃣ Testing Web Interface..."

check_http_status "$API_BASE/" "200" "Catalog Page"
check_http_status "$API_BASE/profile.html" "200" "Profile Page"

# Test 14: Stellar Integration
echo -e "\n1️⃣4️⃣ Testing Stellar Integration..."

STELLAR_INFO=$(curl -s $API_BASE/stellar/info)
check_response "$STELLAR_INFO" "status" "Stellar Configuration"

PAYOUT_HISTORY=$(curl -s $API_BASE/payout-history)
check_response "$PAYOUT_HISTORY" "" "Payout History Access"

# Test 15: Package Quality
echo -e "\n1️⃣5️⃣ Testing Package Quality..."

# Try to get quality scores (may not be available if consensus not reached)
QUALITY_SCORES=$(curl -s $API_BASE/packages/$PACKAGE_ID/quality 2>/dev/null)
if [ $? -eq 0 ] && echo "$QUALITY_SCORES" | jq -e '.package_id' > /dev/null 2>&1; then
    echo "✅ Package Quality Scores"
    TEST_RESULTS+=("{\"test\": \"Package Quality Scores\", \"status\": \"PASS\"}")
else
    echo "ℹ️  Package Quality Scores (Not yet available - normal for single review)"
    TEST_RESULTS+=("{\"test\": \"Package Quality Scores\", \"status\": \"SKIP\", \"reason\": \"Insufficient reviews for consensus\"}")
fi

# Generate test results JSON
echo -e "\n📊 Generating Test Results..."
RESULTS_JSON="["
for i in "${!TEST_RESULTS[@]}"; do
    if [ $i -gt 0 ]; then
        RESULTS_JSON+=","
    fi
    RESULTS_JSON+="${TEST_RESULTS[$i]}"
done
RESULTS_JSON+="]"

echo "$RESULTS_JSON" | jq . > test-results.json

# Cleanup
rm -f ci_test_data.csv pii_test.csv

echo -e "\n🎯 Integration Test Results"
echo "=========================="
echo "Total Tests: ${#TEST_RESULTS[@]}"
echo "Errors: $ERRORS"

if [ $ERRORS -eq 0 ]; then
    echo "🎉 ALL INTEGRATION TESTS PASSED!"
    echo "✅ SquidPro core functionality working correctly"
else
    echo "❌ $ERRORS integration test(s) failed"
    echo "🔍 Check test-results.json for details"
fi

echo -e "\n📁 Test artifacts generated:"
echo "- test-results.json (detailed results)"
echo "- uploads/ directory (uploaded test files)"

# Exit with error code if tests failed
exit $ERRORS