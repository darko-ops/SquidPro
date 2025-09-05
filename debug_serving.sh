#!/bin/bash

echo "🐛 Debugging Upload Data Serving"
echo "================================"

FILENAME="16_20250904_222805_291472b9f9735aa1.csv"

# Test 1: Check pandas can read the file
echo "1️⃣ Testing pandas CSV reading..."
docker exec squidpro-squidpro-api-1 python3 -c "
import pandas as pd
try:
    df = pd.read_csv('/app/uploads/$FILENAME')
    print('✅ Pandas can read the file')
    print(f'   Shape: {df.shape}')
    
    # Test JSON serialization
    json_data = df.to_dict(orient='records')
    print('✅ Data can be converted to JSON')
    print(f'   First row: {json_data[0]}')
except Exception as e:
    print(f'❌ Pandas error: {e}')
"

# Test 2: Get API logs
echo -e "\n2️⃣ Recent API logs:"
docker logs squidpro-squidpro-api-1 --tail 15

# Test 3: Try direct curl with verbose output
echo -e "\n3️⃣ Testing endpoint with verbose curl..."
TOKEN=$(curl -s -X POST http://localhost:8100/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"debug","credits":1.0}' | jq -r '.token')

curl -v -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8100/data/uploaded/$FILENAME" 2>&1 | head -20
