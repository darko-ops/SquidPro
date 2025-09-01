# SQUID PRO MVP (Demo)

This is a minimal, runnable prototype of **Squid Pro** — a governed data exchange for agents with micropayments-style payout math.

## What's included
- **squidpro-api** (FastAPI, port 8100): issues data tokens and serves `/data/price`.
- **collector-crypto** (FastAPI, port 8200): demo price source (sine+noise).
- **Payout math**: supplier/reviewer/squidpro split is calculated per request (demo-only).

## Run
```bash
docker compose up --build
```

## Try it
1) Mint a token:
```bash
curl -s -X POST http://localhost:8100/mint \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"bot01","scope":"data.read.price","credits":1.0}' | jq
```

Copy the `token` from the response.

2) Request a price (pays the micro-fee and returns payout breakdown):
```bash
curl -s "http://localhost:8100/data/price?pair=BTCUSDT" \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>" | jq
```

You should see JSON like:
```json
{
  "trace_id": "...",
  "pair": "BTCUSDT",
  "ts": 1690000000,
  "price": 59850.22,
  "volume": 123.44,
  "cost": 0.005,
  "payout": {"supplier": 0.0035, "reviewer_pool": 0.001, "squidpro": 0.0005}
}
```

> Note: This MVP doesn't persist balances yet — it's focused on the *flow* (mint → query → receipt with splits).
> Next steps: add Postgres for balances, suppliers, reviewers, and a payout ledger.

## Env knobs
- `PRICE_PER_QUERY_USD` (default `0.005`)
- `SUPPLIER_SPLIT` (default `0.7`)
- `REVIEWER_SPLIT` (default `0.2`)
- `SQUIDPRO_SPLIT` (default `0.1`)
