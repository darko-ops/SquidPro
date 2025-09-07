#!/bin/bash

echo "🛡️ SquidPro Security Tests"
echo "=========================="

API_BASE="http://localhost:8100"
ERRORS=0
SECURITY_RESULTS=()

# Helper function to log security test results
log_security_result() {
    local test_name="$1"
    local status="$2"
    local severity="$3"
    local details="$4"
    
    if [ "$status" = "PASS" ]; then
        echo "✅ $test_name"
        SECURITY_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"PASS\", \"severity\": \"$severity\", \"details\": \"$details\"}")
    else
        echo "❌ $test_name"
        echo "   Details: $details"
        SECURITY_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"FAIL\", \"severity\": \"$severity\", \"details\": \"$details\"}")
        if [ "$severity" = "HIGH" ] || [ "$severity" = "CRITICAL" ]; then
            ((ERRORS++))
        fi
    fi
}

# Wait for services
echo "⏳ Waiting for services to be ready..."
for i in {1..30}; do
    if curl -f $API_BASE/health > /dev/null 2>&1; then
        echo "✅ Services are ready"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Test 1: Authentication Security
echo -e "\n1️⃣ Testing Authentication Security..."

# Test 1.1: Invalid API key rejection
INVALID_KEY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: malicious_key" $API_BASE/suppliers/me)
if [ "$INVALID_KEY_STATUS" = "401" ]; then
    log_security_result "Invalid API Key Rejection" "PASS" "HIGH" "Returns 401 for invalid keys"
else
    log_security_result "Invalid API Key Rejection" "FAIL" "HIGH" "Expected 401, got $INVALID_KEY_STATUS"
fi

# Test 1.2: Invalid JWT token rejection
INVALID_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid.jwt.token" $API_BASE/data/price)
if [ "$INVALID_TOKEN_STATUS" = "401" ]; then
    log_security_result "Invalid JWT Token Rejection" "PASS" "HIGH" "Returns 401 for invalid JWT"
else
    log_security_result "Invalid JWT Token Rejection" "FAIL" "HIGH" "Expected 401, got $INVALID_TOKEN_STATUS"
fi

# Test 1.3: Missing authentication rejection
NO_AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE/suppliers/me)
if [ "$NO_AUTH_STATUS" = "401" ]; then
    log_security_result "Missing Authentication Rejection" "PASS" "HIGH" "Returns 401 when no auth provided"
else
    log_security_result "Missing Authentication Rejection" "FAIL" "HIGH" "Expected 401, got $NO_AUTH_STATUS"
fi

# Test 2: SQL Injection Protection
echo -e "\n2️⃣ Testing SQL Injection Protection..."

# Create test file for SQL injection attempts
cat > sqli_test.py << 'EOF'
import requests
import json

API_BASE = "http://localhost:8100"

# SQL injection payloads
sqli_payloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM balances --",
    "1' OR '1'='1' --",
    "admin'--",
    "' OR 1=1#"
]

# Test registration endpoints
for payload in sqli_payloads:
    try:
        # Test supplier registration
        response = requests.post(f"{API_BASE}/suppliers/register", json={
            "name": payload,
            "email": f"test{payload}@example.com",
            "stellar_address": "GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU"
        }, timeout=5)
        
        if response.status_code == 500 or "syntax error" in response.text.lower():
            print(f"VULNERABLE: SQL injection possible with payload: {payload}")
            exit(1)
        elif response.status_code in [400, 422]:
            print(f"PROTECTED: Payload rejected with validation error: {payload}")
        else:
            print(f"HANDLED: Payload processed normally: {payload}")
            
    except requests.exceptions.RequestException:
        print(f"TIMEOUT: Request timed out for payload: {payload}")

print("SQL_INJECTION_PROTECTED")
EOF

# Run SQL injection test
SQLI_RESULT=$(python sqli_test.py 2>&1 | tail -1)
if [ "$SQLI_RESULT" = "SQL_INJECTION_PROTECTED" ]; then
    log_security_result "SQL Injection Protection" "PASS" "CRITICAL" "No SQL injection vulnerabilities found"
else
    log_security_result "SQL Injection Protection" "FAIL" "CRITICAL" "Potential SQL injection vulnerability: $SQLI_RESULT"
fi

# Test 3: File Upload Security
echo -e "\n3️⃣ Testing File Upload Security..."

# Register test supplier for upload tests
SUPPLIER_REG=$(curl -s -X POST $API_BASE/suppliers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Security Test Supplier",
    "email": "security@example.com",
    "stellar_address": "GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU"
  }')
SUPPLIER_KEY=$(echo "$SUPPLIER_REG" | jq -r '.api_key')

# Test 3.1: File size limits
echo "Creating large file for size limit test..."
dd if=/dev/zero of=large_file.csv bs=1M count=15 2>/dev/null

LARGE_FILE_RESPONSE=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@large_file.csv" \
  -F "name=Large File Test")

if echo "$LARGE_FILE_RESPONSE" | grep -q "too large\|File too large"; then
    log_security_result "File Size Limit Enforcement" "PASS" "MEDIUM" "Large files properly rejected"
else
    log_security_result "File Size Limit Enforcement" "FAIL" "MEDIUM" "Large file not rejected"
fi

# Test 3.2: File type restrictions
echo "Creating malicious script file..."
cat > malicious.php << 'EOF'
<?php
system($_GET['cmd']);
?>
EOF

MALICIOUS_FILE_RESPONSE=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@malicious.php" \
  -F "name=Malicious Script")

if echo "$MALICIOUS_FILE_RESPONSE" | grep -q "Only CSV\|file type\|not supported"; then
    log_security_result "File Type Restriction" "PASS" "HIGH" "Non-CSV files properly rejected"
else
    log_security_result "File Type Restriction" "FAIL" "HIGH" "Malicious file type not rejected"
fi

# Test 3.3: Path traversal protection
echo "Testing path traversal..."
cat > path_traversal.csv << 'EOF'
name,value
test,../../../etc/passwd
EOF

PATH_TRAVERSAL_RESPONSE=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@path_traversal.csv" \
  -F "name=../../../malicious")

# Check if file was saved with sanitized name
MALICIOUS_FILES=$(find uploads/ -name "*etc*" -o -name "*passwd*" -o -name "*malicious*" 2>/dev/null | wc -l)
if [ "$MALICIOUS_FILES" -eq 0 ]; then
    log_security_result "Path Traversal Protection" "PASS" "HIGH" "Path traversal attempts blocked"
else
    log_security_result "Path Traversal Protection" "FAIL" "HIGH" "Path traversal successful"
fi

# Test 4: PII Data Protection
echo -e "\n4️⃣ Testing PII Data Protection..."

# Test 4.1: PII detection and blocking
cat > pii_test.csv << 'EOF'
name,email,ssn,credit_card
John Doe,john@example.com,123-45-6789,4532-1234-5678-9012
Jane Smith,jane@example.com,987-65-4321,5555-4444-3333-2222
EOF

PII_UPLOAD_RESPONSE=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@pii_test.csv" \
  -F "name=PII Test Dataset")

if echo "$PII_UPLOAD_RESPONSE" | grep -q "PII_DETECTED\|blocked\|sensitive data"; then
    log_security_result "PII Detection and Blocking" "PASS" "HIGH" "PII data properly detected and blocked"
else
    log_security_result "PII Detection and Blocking" "FAIL" "HIGH" "PII data not detected or blocked"
fi

# Test 5: API Rate Limiting
echo -e "\n5️⃣ Testing API Rate Limiting..."

# Create valid token for rate limit testing
TOKEN_RESPONSE=$(curl -s -X POST $API_BASE/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"rate_limit_test","credits":50.0}')
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')

# Rapid fire requests
echo "Testing rapid requests..."
RATE_LIMIT_RESULTS=()
for i in {1..20}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API_BASE/data/price" --max-time 1)
    RATE_LIMIT_RESULTS+=("$STATUS")
    
    # Check for rate limiting indicators
    if [ "$STATUS" = "429" ] || [ "$STATUS" = "503" ]; then
        log_security_result "API Rate Limiting" "PASS" "MEDIUM" "Rate limiting active after $i requests"
        break
    fi
done

# If no rate limiting detected
if [ "${#RATE_LIMIT_RESULTS[@]}" -eq 20 ] && [ "${RATE_LIMIT_RESULTS[-1]}" = "200" ]; then
    log_security_result "API Rate Limiting" "FAIL" "MEDIUM" "No rate limiting detected after 20 requests"
fi

# Test 6: CORS Security
echo -e "\n6️⃣ Testing CORS Security..."

# Test CORS headers
CORS_RESPONSE=$(curl -s -H "Origin: http://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-API-Key" \
  -X OPTIONS $API_BASE/suppliers/register)

# Check if CORS allows all origins (potential security issue)
if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin: \*"; then
    log_security_result "CORS Configuration" "FAIL" "MEDIUM" "CORS allows all origins (*)"
else
    log_security_result "CORS Configuration" "PASS" "MEDIUM" "CORS properly configured"
fi

# Test 7: Information Disclosure
echo -e "\n7️⃣ Testing Information Disclosure..."

# Test 7.1: Error message security
ERROR_RESPONSE=$(curl -s $API_BASE/data/package/99999)
if echo "$ERROR_RESPONSE" | grep -qi "database\|sql\|stack trace\|internal error"; then
    log_security_result "Error Message Security" "FAIL" "MEDIUM" "Detailed error information exposed"
else
    log_security_result "Error Message Security" "PASS" "MEDIUM" "Error messages properly sanitized"
fi

# Test 7.2: Version disclosure
VERSION_RESPONSE=$(curl -s -I $API_BASE/ | grep -i server)
if echo "$VERSION_RESPONSE" | grep -qi "fastapi\|uvicorn"; then
    log_security_result "Version Information Disclosure" "FAIL" "LOW" "Server version information exposed"
else
    log_security_result "Version Information Disclosure" "PASS" "LOW" "Server version properly hidden"
fi

# Test 8: Input Validation
echo -e "\n8️⃣ Testing Input Validation..."

# Test 8.1: XSS prevention in uploads
cat > xss_test.csv << 'EOF'
name,description
Product,<script>alert('XSS')</script>
Item,"<img src=x onerror=alert('XSS')>"
EOF

XSS_UPLOAD=$(curl -s -X POST $API_BASE/suppliers/upload \
  -H "X-API-Key: $SUPPLIER_KEY" \
  -F "file=@xss_test.csv" \
  -F "name=XSS Test <script>alert('xss')</script>")

if echo "$XSS_UPLOAD" | jq -e '.package_id' > /dev/null 2>&1; then
    PACKAGE_ID=$(echo "$XSS_UPLOAD" | jq -r '.package_id')
    
    # Check if XSS payloads are properly escaped in API responses
    PACKAGE_INFO=$(curl -s $API_BASE/packages/$PACKAGE_ID)
    if echo "$PACKAGE_INFO" | grep -q "<script>\|onerror="; then
        log_security_result "XSS Prevention" "FAIL" "HIGH" "XSS payloads not properly escaped"
    else
        log_security_result "XSS Prevention" "PASS" "HIGH" "XSS payloads properly handled"
    fi
else
    log_security_result "XSS Prevention" "PASS" "HIGH" "XSS in filename blocked upload"
fi

# Test 8.2: JSON injection
JSON_INJECTION=$(curl -s -X POST $API_BASE/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "\"; DROP TABLE users; --", "credits": 999999}')

if echo "$JSON_INJECTION" | jq -e '.token' > /dev/null 2>&1; then
    log_security_result "JSON Injection Protection" "PASS" "MEDIUM" "JSON injection properly handled"
else
    log_security_result "JSON Injection Protection" "FAIL" "MEDIUM" "JSON injection may have caused issues"
fi

# Test 9: Business Logic Security
echo -e "\n9️⃣ Testing Business Logic Security..."

# Test 9.1: Negative credits
NEGATIVE_CREDITS=$(curl -s -X POST $API_BASE/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "negative_test", "credits": -999}')

if echo "$NEGATIVE_CREDITS" | grep -q "error\|invalid\|validation"; then
    log_security_result "Negative Credits Prevention" "PASS" "MEDIUM" "Negative credits properly rejected"
else
    log_security_result "Negative Credits Prevention" "FAIL" "MEDIUM" "Negative credits may be allowed"
fi

# Test 9.2: Excessive credits
EXCESSIVE_CREDITS=$(curl -s -X POST $API_BASE/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "excessive_test", "credits": 999999999}')

if echo "$EXCESSIVE_CREDITS" | jq -e '.token' > /dev/null 2>&1; then
    log_security_result "Excessive Credits Limitation" "FAIL" "LOW" "Excessive credits allowed"
else
    log_security_result "Excessive Credits Limitation" "PASS" "LOW" "Excessive credits rejected"
fi

# Test 10: Session Security
echo -e "\n🔟 Testing Session Security..."

# Test JWT token expiration (would need time manipulation for full test)
# For now, just verify tokens have expiration
VALID_TOKEN=$(curl -s -X POST $API_BASE/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "session_test", "credits": 1.0}')

if echo "$VALID_TOKEN" | jq -e '.expires_in_s' > /dev/null 2>&1; then
    EXPIRES_IN=$(echo "$VALID_TOKEN" | jq -r '.expires_in_s')
    if [ "$EXPIRES_IN" -gt 0 ] && [ "$EXPIRES_IN" -le 3600 ]; then
        log_security_result "JWT Token Expiration" "PASS" "MEDIUM" "Tokens have reasonable expiration ($EXPIRES_IN seconds)"
    else
        log_security_result "JWT Token Expiration" "FAIL" "MEDIUM" "Token expiration too long or invalid"
    fi
else
    log_security_result "JWT Token Expiration" "FAIL" "MEDIUM" "Tokens may not have expiration"
fi

# Cleanup test files
rm -f large_file.csv malicious.php path_traversal.csv pii_test.csv xss_test.csv sqli_test.py

# Generate security results JSON
echo -e "\n📊 Generating Security Test Results..."
SECURITY_JSON="["
for i in "${!SECURITY_RESULTS[@]}"; do
    if [ $i -gt 0 ]; then
        SECURITY_JSON+=","
    fi
    SECURITY_JSON+="${SECURITY_RESULTS[$i]}"
done
SECURITY_JSON+="]"

echo "$SECURITY_JSON" | jq . > security-results.json

# Count results by severity
CRITICAL_FAILS=$(echo "$SECURITY_JSON" | jq '[.[] | select(.status=="FAIL" and .severity=="CRITICAL")] | length')
HIGH_FAILS=$(echo "$SECURITY_JSON" | jq '[.[] | select(.status=="FAIL" and .severity=="HIGH")] | length')
MEDIUM_FAILS=$(echo "$SECURITY_JSON" | jq '[.[] | select(.status=="FAIL" and .severity=="MEDIUM")] | length')
LOW_FAILS=$(echo "$SECURITY_JSON" | jq '[.[] | select(.status=="FAIL" and .severity=="LOW")] | length')

echo -e "\n🛡️ Security Test Results Summary"
echo "================================"
echo "Total Security Tests: ${#SECURITY_RESULTS[@]}"
echo "Critical Failures: $CRITICAL_FAILS"
echo "High Severity Failures: $HIGH_FAILS"
echo "Medium Severity Failures: $MEDIUM_FAILS"
echo "Low Severity Failures: $LOW_FAILS"
echo "Total High-Priority Errors: $ERRORS"

if [ $ERRORS -eq 0 ]; then
    echo "🎉 ALL CRITICAL AND HIGH-SEVERITY SECURITY TESTS PASSED!"
    echo "✅ No critical security vulnerabilities detected"
    echo "✅ Authentication and authorization working properly"
    echo "✅ Input validation and sanitization functional"
    echo "✅ File upload security measures in place"
else
    echo "❌ $ERRORS critical/high-severity security issue(s) found"
    echo "🚨 Review security-results.json for detailed analysis"
    echo "🔒 Fix critical issues before production deployment"
fi

echo -e "\n📁 Security test artifacts generated:"
echo "- security-results.json (detailed vulnerability report)"

exit $ERRORS