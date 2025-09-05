#!/bin/bash

echo "🧪 Testing Your Existing Uploaded Datasets"
echo "=========================================="

# Check if API is running
echo "1️⃣ Checking API status..."
if curl -s http://localhost:8100/health > /dev/null; then
    echo "✅ API is running"
else
    echo "❌ API not responding"
    exit 1
fi

# Get your uploaded dataset filenames
echo -e "\n2️⃣ Getting your uploaded dataset filenames..."
FILENAMES=$(docker exec squidpro-postgres-1 psql -U squidpro -d squidpro -t -c "SELECT filename FROM uploaded_datasets;" | tr -d ' \r')

echo "Found uploaded files:"
for filename in $FILENAMES; do
    echo "  - $filename"
done

# Check if files exist in uploads directory
echo -e "\n3️⃣ Checking if files exist in container..."
for filename in $FILENAMES; do
    if docker exec squidpro-squidpro-api-1 test -f "/app/uploads/$filename" 2>/dev/null; then
        echo "✅ $filename exists in uploads directory"
    else
        echo "❌ $filename NOT found in uploads directory"
    fi
done

# Test getting a token
echo -e "\n4️⃣ Getting API token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8100/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test_user","credits":5.0}')

if echo "$TOKEN_RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
    TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
    echo "✅ Got token: ${TOKEN:0:20}..."
else
    echo "❌ Failed to get token:"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

# Test accessing each uploaded dataset
echo -e "\n5️⃣ Testing data access for each uploaded file..."
for filename in $FILENAMES; do
    echo "Testing access to: $filename"
    
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
        "http://localhost:8100/data/uploaded/$filename?limit=2")
    
    if echo "$RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
        echo "✅ Successfully accessed $filename"
        echo "   Data preview:"
        echo "$RESPONSE" | jq '.data' | head -5
    else
        echo "❌ Failed to access $filename"
        echo "   Error response:"
        echo "$RESPONSE"
    fi
    echo ""
done
