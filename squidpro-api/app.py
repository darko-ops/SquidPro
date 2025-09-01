import os, time, uuid, jwt, httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

SECRET = os.getenv("SQUIDPRO_SECRET", "supersecret_change_me")
PRICE = float(os.getenv("PRICE_PER_QUERY_USD", "0.005"))
SPLIT_SUPPLIER = float(os.getenv("SUPPLIER_SPLIT", "0.7"))
SPLIT_REVIEWER = float(os.getenv("REVIEWER_SPLIT", "0.2"))
SPLIT_SQUIDPRO = float(os.getenv("SQUIDPRO_SPLIT", "0.1"))
COLLECTOR = os.getenv("COLLECTOR_CRYPTO_URL", "http://collector-crypto:8200")

api = FastAPI(title="SquidPro", version="0.1.0")

class MintReq(BaseModel):
    agent_id: str
    scope: str = "data.read.price"
    credits: float = 1.0  # demo-only credits in response

@api.get("/health")
def health():
    return {"ok": True}

@api.post("/mint")
def mint(req: MintReq):
    trace_id = str(uuid.uuid4())
    exp = int(time.time()) + 3600  # 1 hour
    token = jwt.encode({
        "iss": "squidpro",
        "sub": req.agent_id,
        "scope": req.scope,
        "trace_id": trace_id,
        "price": PRICE,
        "splits": {"supplier": SPLIT_SUPPLIER, "reviewer": SPLIT_REVIEWER, "squidpro": SPLIT_SQUIDPRO},
        "exp": exp,
        "jti": str(uuid.uuid4())
    }, SECRET, algorithm="HS256")
    return {"token": token, "trace_id": trace_id, "expires_in_s": 3600, "demo_credits": req.credits}

def _auth(auth_header: Optional[str]):
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth_header.split(" ", 1)[1]
    try:
        claims = jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    return claims

@api.get("/data/price")
async def get_price(pair: str = Query("BTCUSDT"), Authorization: Optional[str] = Header(None)):
    claims = _auth(Authorization)
    if claims.get("scope") != "data.read.price":
        raise HTTPException(status_code=403, detail="Scope not allowed for this endpoint")
    # Call collector
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(f"{COLLECTOR}/price", params={"pair": pair})
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Collector error")
    data = r.json()
    # Compute payout splits (demo calculation; not persisted)
    supplier_amt = round(PRICE * SPLIT_SUPPLIER, 6)
    reviewer_pool = round(PRICE * SPLIT_REVIEWER, 6)
    squidpro_amt = round(PRICE * SPLIT_SQUIDPRO, 6)
    receipt = {
        "trace_id": claims["trace_id"],
        "pair": pair,
        "ts": int(time.time()),
        "price": data["price"],
        "volume": data["volume"],
        "cost": PRICE,
        "payout": {"supplier": supplier_amt, "reviewer_pool": reviewer_pool, "squidpro": squidpro_amt}
    }
    return JSONResponse(receipt)
