#!/bin/bash

echo "🚀 Testing SquidPro Upload Feature (Post-Fix)"
echo "============================================="

# Test 1: Check setup
echo "1️⃣ Checking setup..."
if [ ! -d "uploads" ]; then
    echo "❌ uploads directory doesn't exist. Creating it..."
    mkdir -p uploads
fi

if docker ps | grep -q squidpro; then
    echo "✅ Containers are running"
else
    echo "❌ Containers not running. Start with: docker compose up -d"
    exit 1
fi

# Test 2: Check uploads directory is mounted
echo -e "\n2️⃣ Checking uploads directory mount..."
docker exec squidpro-squidpro-api-1 ls -la /app/uploads/ > /dev/null 2>&1 && echo "✅ Uploads directory accessible" || echo "❌ Uploads directory not accessible"

# Test 3: Register a new supplier
echo -e "\n3️⃣ Registering test supplier..."
RESPONSE=$(curl -s -X POST http://localhost:8100/suppliers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Upload Test Supplier",
    "email": "upload-test@example.com",
    "stellar_address": "GDXDSB444OLNDYOJAVGU3JWQO4BEGQT2MCVTDHLOWORRQODJJXO3GBDU"
  }')

if echo "$RESPONSE" | jq -e '.api_key' > /dev/null 2>&1; then
    API_KEY=$(echo "$RESPONSE" | jq -r '.api_key')
    SUPPLIER_ID=$(echo "$RESPONSE" | jq -r '.supplier_id')
    echo "✅ Supplier registered with ID: $SUPPLIER_ID"
    echo "   API Key: ${API_KEY:0:20}..."
else
    echo "❌ Supplier registration failed:"
    echo "$RESPONSE"
    exit 1
fi

# Test 4: Create test dataset
echo -e "\n4️⃣ Creating test dataset..."
cat > test_crypto_data.csv << 'CSVEOF'
symbol,price,volume,market_cap,change_24h
BTC,67500.00,1234567890,1300000000000,2.1
ETH,3400.00,987654321,400000000000,-0.8
SOL,160.00,123456789,70000000000,4.2
ADA,0.45,567890123,15000000000,-1.2
DOT,6.50,234567890,8000000000,3.1
CSVEOF

echo "✅ Test dataset created with 5 crypto currencies"

# Test 5: Upload the dataset
echo -e "\n5️⃣ Uploading dataset..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:8100/suppliers/upload \
  -H "X-API-Key: $API_KEY" \
  -F "file=@test_crypto_data.csv" \
  -F "name=Post-Fix Crypto Dataset" \
  -F "description=Test dataset uploaded after fixing volume mount" \
  -F "category=financial" \
  -F "price_per_query=0.008" \
  -F "tags=crypto,test,fixed")

if echo "$UPLOAD_RESPONSE" | jq -e '.package_id' > /dev/null 2>&1; then
    PACKAGE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.package_id')
    FILENAME=$(echo "$UPLOAD_RESPONSE" | jq -r '.filename')
    ROW_COUNT=$(echo "$UPLOAD_RESPONSE" | jq -r '.row_count')
    echo "✅ Upload successful!"
    echo "   Package ID: $PACKAGE_ID"
    echo "   Filename: $FILENAME"
    echo "   Rows: $ROW_COUNT"
else
    echo "❌ Upload failed:"
    echo "$UPLOAD_RESPONSE"
    exit 1
fi

# Test 6: Verify file exists on disk
echo -e "\n6️⃣ Verifying file persisted to disk..."
if [ -f "uploads/$FILENAME" ]; then
    echo "✅ File exists in local uploads directory"
    echo "   File size: $(wc -c < uploads/$FILENAME) bytes"
else
    echo "❌ File not found in local uploads directory"
fi

# Test 7: Get API token for data access
echo -e "\n7️⃣ Getting API token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8100/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"upload_test","credits":5.0}')

if echo "$TOKEN_RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
    TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
    echo "✅ Got access token"
else
    echo "❌ Failed to get token"
    exit 1
fi

# Test 8: Access uploaded data
echo -e "\n8️⃣ Testing data access..."
DATA_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8100/data/uploaded/$FILENAME?limit=3")

if echo "$DATA_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    echo "✅ Successfully accessed uploaded data!"
    echo "   Sample data:"
    echo "$DATA_RESPONSE" | jq '.data[0]'
else
    echo "❌ Failed to access data:"
    echo "$DATA_RESPONSE"
fi

# Cleanup
rm -f test_crypto_data.csv

echo -e "\n🎉 Upload Feature Test Complete!"
if [ -f "uploads/$FILENAME" ]; then
    echo "✅ Your upload feature is working correctly!"
    echo "   Test file saved as: uploads/$FILENAME"
    echo "   Visit http://localhost:8100/ to see your uploaded package"
else
    echo "❌ Upload feature still has issues"
fi
