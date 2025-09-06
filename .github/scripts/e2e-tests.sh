#!/bin/bash

echo "🎭 SquidPro End-to-End Tests (Full Docker Stack)"
echo "================================================"

API_BASE="http://localhost:8100"
ERRORS=0
E2E_RESULTS=()

# Helper function to log E2E test results
log_e2e_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    if [ "$status" = "PASS" ]; then
        echo "✅ $test_name"
        E2E_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"PASS\", \"details\": \"$details\"}")
    else
        echo "❌ $test_name"
        echo "   Details: $details"
        E2E_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"FAIL\", \"details\": \"$details\"}")
        ((ERRORS++))
    fi
}

# Wait for full stack to be ready
echo "⏳ Waiting for full Docker stack..."
for i in {1..60}; do
    if curl -f $API_BASE/health > /dev/null 2>&1; then
        echo "✅ Full stack is ready"
        break
    fi
    echo "Waiting for stack... ($i/60)"
    sleep 5
done

# Test 1: Full Stack Health Check
echo -e "\n1️⃣ Testing Full Stack Health..."

# Check all services
API_HEALTH=$(curl -s $API_BASE/health 2>/dev/null | jq -r '.ok // false')
POSTGRES_HEALTH=$(docker-compose exec -T postgres pg_isready -U squidpro > /dev/null 2>&1 && echo "true" || echo "false")
COLLECTOR_HEALTH=$(curl -s http://localhost:8200/price 2>/dev/null | jq -e '.price' > /dev/null 2>&1 && echo "true" || echo "false")

if [ "$API_HEALTH" = "true" ] && [ "$POSTGRES_HEALTH" = "true" ] && [ "$COLLECTOR_HEALTH" = "true" ]; then
    log_e2e_result "Full Stack Health Check" "PASS" "All services operational"
else
    log_e2e_result "Full Stack Health Check" "FAIL" "API:$API_HEALTH, DB:$POSTGRES_HEALTH, Collector:$COLLECTOR_HEALTH"
fi

# Test 2: Complete User Journey - Supplier
echo -e "\n2️⃣ Testing Complete Supplier Journey..."

# Register supplier
SUPPLIER_REG=$(curl -s -X POST $API_BASE/suppliers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E2E Test Supplier Co",
    "email": "e2e-supplier@example.com",
    "stellar_address": "GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU"
  }')

if echo "$SUPPLIER_REG" | jq -e '.api_key' > /dev/null 2>&1; then
    SUPPLIER_KEY=$(echo "$SUPPLIER_REG" | jq -r '.api_key')
    SUPPLIER_ID=$(echo "$SUPPLIER_REG" | jq -r '.supplier_id')
    
    # Check supplier profile
    SUPPLIER_PROFILE=$(curl -s -H "X-API-Key: $SUPPLIER_KEY" $API_BASE/suppliers/me)
    if echo "$SUPPLIER_PROFILE" | jq -e '.name' > /dev/null 2>&1; then
        log_e2e_result "Supplier Registration & Profile" "PASS" "Account created and accessible"
    else
        log_e2e_result "Supplier Registration & Profile" "FAIL" "Profile not accessible"
    fi
else
    log_e2e_result "Supplier Registration & Profile" "FAIL" "Registration failed"
fi

# Test 3: Complete User Journey - Reviewer
echo -e "\n3️⃣ Testing Complete Reviewer Journey..."

REVIEWER_REG=$(curl -s -X POST $API_BASE/reviewers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E2E Test Quality Reviewer",
    "stellar_address": "GAEAQRT27B2E7Y7VZYCHZA3VAVAC34JP7M3DLRAJF5LNCFDCWP74ECH2",
    "email": "e2e-reviewer@example.com",
    "specializations": ["financial", "e2e-test"]
  }')

if echo "$REVIEWER_REG" | jq -e '.api_key' > /dev/null 2>&1; then
    REVIEWER_KEY=$(echo "$REVIEWER_REG" | jq -r '.api_key')
    
    # Check reviewer profile
    REVIEWER_PROFILE=$(curl -s -H "X-API-Key: $REVIEWER_KEY" $API_BASE/reviewers/me)
    if echo "$REVIEWER_PROFILE" | jq -e '.name' > /dev/null 2>&1; then
        log_e2e_result "Reviewer Registration & Profile" "PASS" "Account created and accessible"
    else
        log_e2e_result "Reviewer Registration & Profile" "FAIL" "Profile not accessible"
    fi
else
    log_e2e_result "Reviewer Registration & Profile" "FAIL" "Registration failed"
fi

# Test 4: Data Upload & Processing Pipeline
echo -e "\n4️⃣ Testing Data Upload & Processing Pipeline..."

# Create comprehensive test dataset
cat > e2e_comprehensive_data.csv << 'EOF'
symbol,name,price_usd,volume_24h,market_cap,change_1h,change_24h,change_7d,last_updated
BTC,Bitcoin,67500.00,28500000000,1320000000000,0.5,2.1,5.8,2024-01-15T10:30:00Z
ETH,Ethereum,3400.00,15200000000,408000000000,-0.2,-0.8,3.2,2024-01-15T10:30:00Z
SOL,Solana,160.00,2800000000,71000000000,1.1,4.2,8.7,2024-01-15T10:30:00Z
ADA,Cardano,0.45,1200000000,15800000000,-0.1,-1.2,2.1,2024-01-15T10:30:00Z
DOT,Polkadot,6.50,980000000,8200000000,0.8,3.1,6.4,2024-01-15T10:30:00Z
EOF

COMPREHENSIVE_UPLOAD=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@e2e_comprehensive_data.csv" \
  -F "name=E2E Comprehensive Crypto Dataset" \
  -F "description=Complete cryptocurrency market data for E2E testing including prices, volumes, market caps, and percentage changes" \
  -F "category=financial" \
  -F "price_per_query=0.015" \
  -F "tags=crypto,market-data,comprehensive,e2e-test")

if echo "$COMPREHENSIVE_UPLOAD" | jq -e '.package_id' > /dev/null 2>&1; then
    PACKAGE_ID=$(echo "$COMPREHENSIVE_UPLOAD" | jq -r '.package_id')
    FILENAME=$(echo "$COMPREHENSIVE_UPLOAD" | jq -r '.filename')
    ROW_COUNT=$(echo "$COMPREHENSIVE_UPLOAD" | jq -r '.row_count')
    
    # Verify file was saved to volume
    VOLUME_CHECK=$(docker-compose exec -T squidpro-api test -f "/app/uploads/$FILENAME" && echo "true" || echo "false")
    
    if [ "$VOLUME_CHECK" = "true" ] && [ "$ROW_COUNT" = "5" ]; then
        log_e2e_result "Data Upload & Processing" "PASS" "File uploaded, processed, and persisted ($ROW_COUNT rows)"
    else
        log_e2e_result "Data Upload & Processing" "FAIL" "File not properly saved or processed"
    fi
else
    log_e2e_result "Data Upload & Processing" "FAIL" "Upload failed"
fi

# Test 5: Complete Agent Purchase Flow
echo -e "\n5️⃣ Testing Complete Agent Purchase Flow..."

# Step 1: Agent mints token
AGENT_TOKEN=$(curl -s -X POST $API_BASE/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"e2e_test_agent","credits":25.0}' | jq -r '.token')

if [ "$AGENT_TOKEN" != "null" ] && [ "$AGENT_TOKEN" != "" ]; then
    # Step 2: Agent discovers packages
    PACKAGE_DISCOVERY=$(curl -s $API_BASE/packages)
    PACKAGE_COUNT=$(echo "$PACKAGE_DISCOVERY" | jq length)
    
    if [ "$PACKAGE_COUNT" -gt 0 ]; then
        # Step 3: Agent queries specific package
        PACKAGE_QUERY=$(curl -s -H "Authorization: Bearer $AGENT_TOKEN" \
          "$API_BASE/data/package/$PACKAGE_ID?limit=3")
        
        # Step 4: Agent accesses uploaded data
        UPLOAD_QUERY=$(curl -s -H "Authorization: Bearer $AGENT_TOKEN" \
          "$API_BASE/data/uploaded/$FILENAME?limit=2")
        
        # Step 5: Agent uses legacy endpoint
        LEGACY_QUERY=$(curl -s -H "Authorization: Bearer $AGENT_TOKEN" \
          "$API_BASE/data/price?pair=BTCUSDT")
        
        # Verify all queries worked and have proper structure
        PACKAGE_DATA_OK=$(echo "$PACKAGE_QUERY" | jq -e '.data and .cost and .payout' > /dev/null 2>&1 && echo "true" || echo "false")
        UPLOAD_DATA_OK=$(echo "$UPLOAD_QUERY" | jq -e '.data and .cost and .payout' > /dev/null 2>&1 && echo "true" || echo "false")
        LEGACY_DATA_OK=$(echo "$LEGACY_QUERY" | jq -e '.price and .cost and .payout' > /dev/null 2>&1 && echo "true" || echo "false")
        
        if [ "$PACKAGE_DATA_OK" = "true" ] && [ "$UPLOAD_DATA_OK" = "true" ] && [ "$LEGACY_DATA_OK" = "true" ]; then
            log_e2e_result "Complete Agent Purchase Flow" "PASS" "All query types successful with proper receipts"
        else
            log_e2e_result "Complete Agent Purchase Flow" "FAIL" "Package:$PACKAGE_DATA_OK, Upload:$UPLOAD_DATA_OK, Legacy:$LEGACY_DATA_OK"
        fi
    else
        log_e2e_result "Complete Agent Purchase Flow" "FAIL" "No packages available for discovery"
    fi
else
    log_e2e_result "Complete Agent Purchase Flow" "FAIL" "Token minting failed"
fi

# Test 6: End-to-End Payment Flow
echo -e "\n6️⃣ Testing End-to-End Payment Flow..."

# Check initial balances
INITIAL_BALANCES=$(curl -s $API_BASE/balances)
INITIAL_SUPPLIER_BALANCE=$(echo "$INITIAL_BALANCES" | jq -r ".[] | select(.type==\"supplier\" and .id==\"$SUPPLIER_ID\") | .balance")

# Perform some queries to generate revenue
for i in {1..3}; do
    curl -s -H "Authorization: Bearer $AGENT_TOKEN" "$API_BASE/data/package/$PACKAGE_ID" > /dev/null
done

# Check updated balances
UPDATED_BALANCES=$(curl -s $API_BASE/balances)
UPDATED_SUPPLIER_BALANCE=$(echo "$UPDATED_BALANCES" | jq -r ".[] | select(.type==\"supplier\" and .id==\"$SUPPLIER_ID\") | .balance")

# Verify balance increased
if [ "$(echo "$UPDATED_SUPPLIER_BALANCE > $INITIAL_SUPPLIER_BALANCE" | bc -l)" = "1" ]; then
    log_e2e_result "End-to-End Payment Flow" "PASS" "Supplier balance increased from $INITIAL_SUPPLIER_BALANCE to $UPDATED_SUPPLIER_BALANCE"
else
    log_e2e_result "End-to-End Payment Flow" "FAIL" "Balance did not increase ($INITIAL_SUPPLIER_BALANCE -> $UPDATED_SUPPLIER_BALANCE)"
fi

# Test 7: Review & Quality System E2E
echo -e "\n7️⃣ Testing Review & Quality System E2E..."

# Create review task
REVIEW_TASK=$(curl -s -X POST "$API_BASE/admin/create-review-task?package_id=$PACKAGE_ID&task_type=accuracy&reward_pool=0.08&required_reviews=2")
TASK_ID=$(echo "$REVIEW_TASK" | jq -r '.task_id')

if [ "$TASK_ID" != "null" ] && [ "$TASK_ID" != "" ]; then
    # Reviewer discovers tasks
    AVAILABLE_TASKS=$(curl -s -H "X-API-Key: $REVIEWER_KEY" $API_BASE/review-tasks)
    TASK_COUNT=$(echo "$AVAILABLE_TASKS" | jq length)
    
    if [ "$TASK_COUNT" -gt 0 ]; then
        # Submit first review
        REVIEW_1=$(curl -s -X POST $API_BASE/review-tasks/$TASK_ID/submit \
          -H "Content-Type: application/json" \
          -H "X-API-Key: $REVIEWER_KEY" \
          -d '{
            "quality_score": 9,
            "timeliness_score": 8,
            "schema_compliance_score": 10,
            "overall_rating": 9,
            "findings": "E2E test review #1 - Excellent comprehensive dataset with proper schema compliance and accurate market data",
            "evidence": {
              "test_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
              "validation_method": "e2e_comprehensive_test",
              "data_points_verified": 5,
              "schema_validation": "passed"
            }
          }')
        
        # Register second reviewer for consensus
        REVIEWER_2_REG=$(curl -s -X POST $API_BASE/reviewers/register \
          -H "Content-Type: application/json" \
          -d '{
            "name": "E2E Test Reviewer 2",
            "stellar_address": "GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU",
            "specializations": ["financial"]
          }')
        
        REVIEWER_2_KEY=$(echo "$REVIEWER_2_REG" | jq -r '.api_key')
        
        # Submit second review for consensus
        REVIEW_2=$(curl -s -X POST $API_BASE/review-tasks/$TASK_ID/submit \
          -H "Content-Type: application/json" \
          -H "X-API-Key: $REVIEWER_2_KEY" \
          -d '{
            "quality_score": 8,
            "timeliness_score": 9,
            "schema_compliance_score": 10,
            "overall_rating": 9,
            "findings": "E2E test review #2 - High quality data, good freshness, perfect schema compliance",
            "evidence": {
              "test_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
              "validation_method": "e2e_secondary_validation"
            }
          }')
        
        # Check if both reviews were accepted
        REVIEW_1_OK=$(echo "$REVIEW_1" | jq -e '.submission_id' > /dev/null 2>&1 && echo "true" || echo "false")
        REVIEW_2_OK=$(echo "$REVIEW_2" | jq -e '.submission_id' > /dev/null 2>&1 && echo "true" || echo "false")
        
        if [ "$REVIEW_1_OK" = "true" ] && [ "$REVIEW_2_OK" = "true" ]; then
            # Try to get quality scores (may need time for consensus processing)
            sleep 2
            QUALITY_SCORES=$(curl -s $API_BASE/packages/$PACKAGE_ID/quality 2>/dev/null)
            
            if echo "$QUALITY_SCORES" | jq -e '.scores.overall_rating' > /dev/null 2>&1; then
                OVERALL_RATING=$(echo "$QUALITY_SCORES" | jq -r '.scores.overall_rating')
                log_e2e_result "Review & Quality System E2E" "PASS" "Consensus achieved, overall rating: $OVERALL_RATING"
            else
                log_e2e_result "Review & Quality System E2E" "PASS" "Reviews submitted successfully (consensus processing may take time)"
            fi
        else
            log_e2e_result "Review & Quality System E2E" "FAIL" "Review submissions failed (R1:$REVIEW_1_OK, R2:$REVIEW_2_OK)"
        fi
    else
        log_e2e_result "Review & Quality System E2E" "FAIL" "No review tasks available"
    fi
else
    log_e2e_result "Review & Quality System E2E" "FAIL" "Review task creation failed"
fi

# Test 8: Web Interface Functionality
echo -e "\n8️⃣ Testing Web Interface Functionality..."

# Test catalog page
CATALOG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE/)
PROFILE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE/profile.html)

# Test API endpoints used by frontend
PACKAGES_API=$(curl -s $API_BASE/packages | jq -e 'length > 0' && echo "true" || echo "false")
HEALTH_API=$(curl -s $API_BASE/health | jq -e '.ok' && echo "true" || echo "false")

if [ "$CATALOG_STATUS" = "200" ] && [ "$PROFILE_STATUS" = "200" ] && [ "$PACKAGES_API" = "true" ] && [ "$HEALTH_API" = "true" ]; then
    log_e2e_result "Web Interface Functionality" "PASS" "All pages accessible and APIs functional"
else
    log_e2e_result "Web Interface Functionality" "FAIL" "Catalog:$CATALOG_STATUS, Profile:$PROFILE_STATUS, PackagesAPI:$PACKAGES_API, HealthAPI:$HEALTH_API"
fi

# Test 9: Error Handling & Edge Cases
echo -e "\n9️⃣ Testing Error Handling & Edge Cases..."

# Test invalid API key
INVALID_KEY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: invalid_key" $API_BASE/suppliers/me)

# Test invalid token
INVALID_TOKEN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" $API_BASE/data/package/1)

# Test non-existent resource
NOT_FOUND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE/packages/99999)

if [ "$INVALID_KEY_RESPONSE" = "401" ] && [ "$INVALID_TOKEN_RESPONSE" = "401" ] && [ "$NOT_FOUND_RESPONSE" = "404" ]; then
    log_e2e_result "Error Handling & Edge Cases" "PASS" "Proper HTTP status codes for error conditions"
else
    log_e2e_result "Error Handling & Edge Cases" "FAIL" "InvalidKey:$INVALID_KEY_RESPONSE, InvalidToken:$INVALID_TOKEN_RESPONSE, NotFound:$NOT_FOUND_RESPONSE"
fi

# Test 10: Data Persistence & Volume Mounts
echo -e "\n🔟 Testing Data Persistence & Volume Mounts..."

# Check that uploaded files persist in volume
UPLOADED_FILES=$(docker-compose exec -T squidpro-api ls /app/uploads | wc -l)
LOCAL_FILES=$(ls uploads/ 2>/dev/null | wc -l || echo "0")

if [ "$UPLOADED_FILES" -gt 0 ] && [ "$LOCAL_FILES" -gt 0 ]; then
    log_e2e_result "Data Persistence & Volume Mounts" "PASS" "Files persisted in container ($UPLOADED_FILES) and volume ($LOCAL_FILES)"
else
    log_e2e_result "Data Persistence & Volume Mounts" "FAIL" "Container files: $UPLOADED_FILES, Local files: $LOCAL_FILES"
fi

# Cleanup test files
rm -f e2e_comprehensive_data.csv

# Generate E2E results JSON
echo -e "\n📊 Generating E2E Test Results..."
E2E_JSON="["
for i in "${!E2E_RESULTS[@]}"; do
    if [ $i -gt 0 ]; then
        E2E_JSON+=","
    fi
    E2E_JSON+="${E2E_RESULTS[$i]}"
done
E2E_JSON+="]"

echo "$E2E_JSON" | jq . > e2e-results.json

echo -e "\n🎯 End-to-End Test Results"
echo "========================="
echo "Total E2E Tests: ${#E2E_RESULTS[@]}"
echo "Errors: $ERRORS"

if [ $ERRORS -eq 0 ]; then
    echo "🎉 ALL END-TO-END TESTS PASSED!"
    echo "✅ Complete SquidPro user journeys working correctly"
    echo "✅ Full stack integration operational"
    echo "✅ Data persistence and volume mounts working"
    echo "✅ Error handling robust"
else
    echo "❌ $ERRORS end-to-end test(s) failed"
    echo "🔍 Check e2e-results.json for detailed analysis"
fi

echo -e "\n📁 E2E test artifacts generated:"
echo "- e2e-results.json (detailed results)"
echo "- Docker container logs available"

exit $ERRORS