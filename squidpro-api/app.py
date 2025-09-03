import os, time, uuid, jwt, httpx, asyncpg, json
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import asyncio
import logging
import secrets
from fastapi.middleware.cors import CORSMiddleware
import statistics
from stellar_sdk import Keypair, Network, Server, TransactionBuilder, Asset
from stellar_sdk.exceptions import SdkError
from decimal import Decimal
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

logging.basicConfig(level=logging.INFO)

SECRET = os.getenv("SQUIDPRO_SECRET", "supersecret_change_me")
PRICE = float(os.getenv("PRICE_PER_QUERY_USD", "0.005"))
SPLIT_SUPPLIER = float(os.getenv("SUPPLIER_SPLIT", "0.7"))
SPLIT_REVIEWER = float(os.getenv("REVIEWER_SPLIT", "0.2"))
SPLIT_SQUIDPRO = float(os.getenv("SQUIDPRO_SPLIT", "0.1"))
COLLECTOR = os.getenv("COLLECTOR_CRYPTO_URL", "http://collector-crypto:8200")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://squidpro:password@postgres:5432/squidpro")

# Stellar configuration
STELLAR_SECRET_KEY = os.getenv("STELLAR_SECRET_KEY", "SAMPLEKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB")
STELLAR_NETWORK = os.getenv("STELLAR_NETWORK", "testnet")
USDC_ASSET_CODE = os.getenv("USDC_ASSET_CODE", "USDC")
USDC_ASSET_ISSUER = os.getenv("USDC_ASSET_ISSUER", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5")

# Stellar setup
try:
    stellar_keypair = Keypair.from_secret(STELLAR_SECRET_KEY)
    stellar_server = Server("https://horizon-testnet.stellar.org") if STELLAR_NETWORK == "testnet" else Server("https://horizon.stellar.org")
    usdc_asset = Asset(USDC_ASSET_CODE, USDC_ASSET_ISSUER)
    logging.info(f"Stellar initialized - Public Key: {stellar_keypair.public_key}")
except Exception as e:
    logging.error(f"Failed to initialize Stellar: {e}")
    stellar_keypair = None

# Database connection pool
db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup with retry logic
    global db_pool
    max_retries = 10
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            logging.info(f"Attempting to connect to database (attempt {attempt + 1}/{max_retries})")
            db_pool = await asyncpg.create_pool(DATABASE_URL)
            logging.info("Successfully connected to database")
            break
        except Exception as e:
            logging.warning(f"Database connection failed: {e}")
            if attempt == max_retries - 1:
                logging.error("Max retries reached, giving up")
                raise
            logging.info(f"Retrying in {retry_delay} seconds...")
            await asyncio.sleep(retry_delay)
    
    yield
    
    # Shutdown
    if db_pool:
        await db_pool.close()

api = FastAPI(title="SquidPro", version="0.1.0", lifespan=lifespan)

# Add CORS middleware
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if os.path.exists("public"):
    api.mount("/static", StaticFiles(directory="public"), name="static")
# Pydantic Models
class MintReq(BaseModel):
    agent_id: str
    scope: str = "data.read.price"
    credits: float = 1.0

class ReviewerRegistration(BaseModel):
    name: str
    stellar_address: str
    email: Optional[str] = None
    specializations: List[str] = []

class ReviewSubmission(BaseModel):
    quality_score: int
    timeliness_score: int
    schema_compliance_score: int
    overall_rating: int
    findings: str
    evidence: Optional[Dict[str, Any]] = None

class SupplierRegistration(BaseModel):
    name: str
    email: str
    stellar_address: str

class DataPackage(BaseModel):
    name: str
    description: str
    category: str
    endpoint_url: str
    price_per_query: float = 0.005
    sample_data: Optional[Dict[str, Any]] = None
    schema_definition: Optional[Dict[str, Any]] = None
    rate_limit: int = 1000
    tags: List[str] = []


@api.get("/")
async def serve_catalog():
    """Serve the data catalog as the main page"""
    return FileResponse("public/catalog.html")

@api.get("/profile.html")
async def serve_profile():
    """Serve the profile page"""
    return FileResponse("public/profile.html")

@api.get("/catalog.html") 
async def serve_catalog_alt():
    """Alternative catalog route"""
    return FileResponse("public/catalog.html")

@api.get("/")
async def serve_catalog():
    """Serve the data catalog as the main page"""
    catalog_path = "public/catalog.html"
    if os.path.exists(catalog_path):
        return FileResponse(catalog_path)
    else:
        return {"message": "SquidPro API is running", "catalog": "catalog.html not found"}

@api.get("/catalog")
async def serve_catalog_alt():
    """Alternative route to serve the catalog"""
    catalog_path = "public/catalog.html"
    if os.path.exists(catalog_path):
        return FileResponse(catalog_path)
    else:
        return {"error": "catalog.html not found in public directory"}
# Reviewer System Endpoints

@api.post("/reviewers/register")
async def register_reviewer(reviewer: ReviewerRegistration):
    """Register as a data quality reviewer"""
    async with db_pool.acquire() as conn:
        # Generate API key
        api_key = f"rev_{secrets.token_urlsafe(16)}"
        
        # Insert reviewer
        reviewer_id = await conn.fetchval("""
            INSERT INTO reviewers (name, stellar_address, email, specializations, api_key)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        """, reviewer.name, reviewer.stellar_address, reviewer.email, 
        reviewer.specializations, api_key)
        
        # Create balance entry
        await conn.execute("""
            INSERT INTO balances (user_type, user_id, payout_threshold_usd)
            VALUES ('reviewer', $1, 5.00)
        """, str(reviewer_id))
        
        # Initialize stats
        await conn.execute("""
            INSERT INTO reviewer_stats (reviewer_id) VALUES ($1)
        """, reviewer_id)
        
        return {
            "reviewer_id": reviewer_id,
            "api_key": api_key,
            "status": "registered",
            "message": "Reviewer registered successfully. Save your API key securely."
        }

async def authenticate_reviewer(api_key: str):
    """Authenticate reviewer by API key"""
    if not api_key or not api_key.startswith('rev_'):
        raise HTTPException(status_code=401, detail="Invalid reviewer API key")
    
    async with db_pool.acquire() as conn:
        reviewer = await conn.fetchrow("""
            SELECT r.id, r.name, r.reputation_level, rs.consensus_rate, rs.accuracy_score
            FROM reviewers r
            LEFT JOIN reviewer_stats rs ON r.id = rs.reviewer_id
            WHERE r.api_key = $1
        """, api_key)
        
        if not reviewer:
            raise HTTPException(status_code=401, detail="Invalid reviewer API key")
        
        return reviewer

@api.get("/reviewers/me")
async def get_reviewer_info(x_api_key: Optional[str] = Header(None)):
    """Get reviewer information and stats"""
    reviewer = await authenticate_reviewer(x_api_key)
    
    async with db_pool.acquire() as conn:
        # Get full reviewer info with stats and balance
        info = await conn.fetchrow("""
            SELECT r.*, rs.*, b.balance_usd, b.payout_threshold_usd
            FROM reviewers r
            LEFT JOIN reviewer_stats rs ON r.id = rs.reviewer_id
            LEFT JOIN balances b ON r.id::text = b.user_id AND b.user_type = 'reviewer'
            WHERE r.id = $1
        """, reviewer["id"])
        
        return {
            "id": info["id"],
            "name": info["name"],
            "stellar_address": info["stellar_address"],
            "reputation_level": info["reputation_level"],
            "specializations": info["specializations"] or [],
            "stats": {
                "total_reviews": info["total_reviews"] or 0,
                "consensus_rate": float(info["consensus_rate"] or 0),
                "accuracy_score": float(info["accuracy_score"] or 0),
                "total_earned": float(info["total_earned"] or 0),
                "avg_review_time_minutes": info["avg_review_time_minutes"] or 0
            },
            "balance": float(info["balance_usd"] or 0),
            "payout_threshold": float(info["payout_threshold_usd"] or 5.00)
        }

@api.get("/review-tasks")
async def get_available_review_tasks(
    category: Optional[str] = None,
    task_type: Optional[str] = None,
    x_api_key: Optional[str] = Header(None)
):
    """Get available review tasks for a reviewer"""
    reviewer = await authenticate_reviewer(x_api_key)
    
    async with db_pool.acquire() as conn:
        # Get open tasks not already reviewed by this reviewer
        query = """
            SELECT rt.*, dp.name as package_name, dp.category, s.name as supplier_name,
                   pqs.overall_rating as current_rating,
                   (rt.required_reviews - COALESCE(submitted_count.count, 0)) as spots_remaining
            FROM review_tasks rt
            JOIN data_packages dp ON rt.package_id = dp.id
            JOIN suppliers s ON dp.supplier_id = s.id
            LEFT JOIN package_quality_scores pqs ON dp.id = pqs.package_id
            LEFT JOIN (
                SELECT task_id, COUNT(*) as count 
                FROM review_submissions 
                GROUP BY task_id
            ) submitted_count ON rt.id = submitted_count.task_id
            WHERE rt.status = 'open' 
            AND rt.expires_at > NOW()
            AND rt.id NOT IN (
                SELECT task_id FROM review_submissions WHERE reviewer_id = $1
            )
            AND (rt.required_reviews - COALESCE(submitted_count.count, 0)) > 0
        """
        
        params = [reviewer["id"]]
        
        if category:
            query += " AND dp.category = $2"
            params.append(category)
        
        if task_type:
            query += f" AND rt.task_type = ${'3' if category else '2'}"
            params.append(task_type)
        
        query += " ORDER BY rt.reward_pool_usd DESC, rt.created_at ASC LIMIT 20"
        
        tasks = await conn.fetch(query, *params)
        
        return [
            {
                "task_id": task["id"],
                "package_name": task["package_name"],
                "supplier": task["supplier_name"],
                "category": task["category"],
                "task_type": task["task_type"],
                "reward_pool": float(task["reward_pool_usd"]),
                "spots_remaining": task["spots_remaining"],
                "current_rating": float(task["current_rating"] or 0),
                "reference_query": task["reference_query"],
                "expires_at": task["expires_at"].isoformat()
            }
            for task in tasks
        ]

@api.post("/review-tasks/{task_id}/submit")
async def submit_review(
    task_id: int,
    review: ReviewSubmission,
    x_api_key: Optional[str] = Header(None)
):
    """Submit a quality review for a task"""
    reviewer = await authenticate_reviewer(x_api_key)
    
    async with db_pool.acquire() as conn:
        # Verify task exists and is open
        task = await conn.fetchrow("""
            SELECT rt.*, dp.name as package_name
            FROM review_tasks rt
            JOIN data_packages dp ON rt.package_id = dp.id
            WHERE rt.id = $1 AND rt.status = 'open' AND rt.expires_at > NOW()
        """, task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found or expired")
        
        # Check if reviewer already submitted for this task
        existing = await conn.fetchval("""
            SELECT id FROM review_submissions 
            WHERE task_id = $1 AND reviewer_id = $2
        """, task_id, reviewer["id"])
        
        if existing:
            raise HTTPException(status_code=409, detail="Already submitted review for this task")
        
        # Insert the review
        submission_id = await conn.fetchval("""
            INSERT INTO review_submissions (
                task_id, reviewer_id, quality_score, timeliness_score, 
                schema_compliance_score, overall_rating, findings, evidence,
                test_timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING id
        """, task_id, reviewer["id"], review.quality_score, review.timeliness_score,
        review.schema_compliance_score, review.overall_rating, review.findings, 
        json.dumps(review.evidence) if review.evidence else None)
        
        # Check if we now have enough reviews to process consensus
        review_count = await conn.fetchval("""
            SELECT COUNT(*) FROM review_submissions WHERE task_id = $1
        """, task_id)
        
        if review_count >= task["required_reviews"]:
            await process_review_consensus(conn, task_id)
        
        return {
            "submission_id": submission_id,
            "status": "submitted",
            "task_name": task["package_name"],
            "message": f"Review submitted. {task['required_reviews'] - review_count} more reviews needed for consensus."
        }

async def process_review_consensus(conn, task_id: int):
    """Process consensus when enough reviews are submitted"""
    # Get all submissions for this task
    submissions = await conn.fetch("""
        SELECT * FROM review_submissions WHERE task_id = $1
    """, task_id)
    
    if len(submissions) < 2:
        return
    
    # Calculate consensus metrics
    quality_scores = [s["quality_score"] for s in submissions]
    timeliness_scores = [s["timeliness_score"] for s in submissions]
    schema_scores = [s["schema_compliance_score"] for s in submissions]
    overall_ratings = [s["overall_rating"] for s in submissions]
    
    # Find consensus (median or close to median)
    median_overall = statistics.median(overall_ratings)
    consensus_threshold = 2  # within 2 points of median
    
    # Get task info
    task = await conn.fetchrow("SELECT * FROM review_tasks WHERE id = $1", task_id)
    reward_per_reviewer = float(task["reward_pool_usd"]) / len(submissions)
    
    # Calculate payouts and mark consensus reviews
    for submission in submissions:
        is_consensus = abs(submission["overall_rating"] - median_overall) <= consensus_threshold
        payout = reward_per_reviewer * (1.2 if is_consensus else 0.8)  # bonus for consensus
        
        # Update submission with consensus status and payout
        await conn.execute("""
            UPDATE review_submissions 
            SET is_consensus = $1, payout_earned = $2
            WHERE id = $3
        """, is_consensus, payout, submission["id"])
        
        # Add to reviewer balance
        await conn.execute("""
            UPDATE balances 
            SET balance_usd = balance_usd + $1
            WHERE user_type = 'reviewer' AND user_id = $2
        """, payout, str(submission["reviewer_id"]))
    
    # Update package quality scores
    await update_package_quality_scores(conn, task["package_id"], submissions)
    
    # Mark task as completed
    await conn.execute("""
        UPDATE review_tasks SET status = 'completed' WHERE id = $1
    """, task_id)
    
    # Update reviewer stats
    for submission in submissions:
        await update_reviewer_stats(conn, submission["reviewer_id"])

async def update_package_quality_scores(conn, package_id: int, submissions: list):
    """Update aggregated quality scores for a package"""
    avg_quality = statistics.mean([s["quality_score"] for s in submissions])
    avg_timeliness = statistics.mean([s["timeliness_score"] for s in submissions])
    avg_schema = statistics.mean([s["schema_compliance_score"] for s in submissions])
    avg_overall = statistics.mean([s["overall_rating"] for s in submissions])
    
    await conn.execute("""
        UPDATE package_quality_scores SET
            avg_quality_score = $1,
            avg_timeliness_score = $2, 
            avg_schema_score = $3,
            overall_rating = $4,
            total_reviews = total_reviews + $5,
            last_reviewed = NOW(),
            updated_at = NOW()
        WHERE package_id = $6
    """, avg_quality, avg_timeliness, avg_schema, avg_overall, len(submissions), package_id)

async def update_reviewer_stats(conn, reviewer_id: int):
    """Update reviewer statistics after completing a review"""
    # Calculate new stats
    stats = await conn.fetchrow("""
        SELECT 
            COUNT(*) as total_reviews,
            AVG(CASE WHEN is_consensus THEN 1.0 ELSE 0.0 END) as consensus_rate,
            SUM(payout_earned) as total_earned
        FROM review_submissions 
        WHERE reviewer_id = $1
    """, reviewer_id)
    
    # Simple accuracy calculation (can be enhanced)
    accuracy_score = min(stats["consensus_rate"] * 10, 10.0) if stats["consensus_rate"] else 0
    
    # Update reputation level
    total_reviews = stats["total_reviews"]
    consensus_rate = float(stats["consensus_rate"] or 0)
    
    if total_reviews >= 100 and consensus_rate >= 0.9:
        reputation_level = "master"
    elif total_reviews >= 50 and consensus_rate >= 0.8:
        reputation_level = "expert" 
    elif total_reviews >= 20 and consensus_rate >= 0.7:
        reputation_level = "experienced"
    else:
        reputation_level = "novice"
    
    # Update stats
    await conn.execute("""
        UPDATE reviewer_stats SET
            total_reviews = $1,
            consensus_rate = $2,
            accuracy_score = $3,
            total_earned = $4,
            reputation_level = $5,
            updated_at = NOW()
        WHERE reviewer_id = $6
    """, total_reviews, stats["consensus_rate"], accuracy_score, 
    float(stats["total_earned"]), reputation_level, reviewer_id)
    
    # Update reviewer table reputation
    await conn.execute("""
        UPDATE reviewers SET reputation_level = $1 WHERE id = $2
    """, reputation_level, reviewer_id)

@api.get("/packages/{package_id}/quality")
async def get_package_quality(package_id: int):
    """Get quality assessment for a data package"""
    async with db_pool.acquire() as conn:
        quality = await conn.fetchrow("""
            SELECT pqs.*, dp.name as package_name, s.name as supplier_name
            FROM package_quality_scores pqs
            JOIN data_packages dp ON pqs.package_id = dp.id
            JOIN suppliers s ON dp.supplier_id = s.id
            WHERE pqs.package_id = $1
        """, package_id)
        
        if not quality:
            raise HTTPException(status_code=404, detail="Package not found")
        
        # Get recent reviews
        recent_reviews = await conn.fetch("""
            SELECT rs.overall_rating, rs.findings, rs.submitted_at, r.name as reviewer_name
            FROM review_submissions rs
            JOIN review_tasks rt ON rs.task_id = rt.id
            JOIN reviewers r ON rs.reviewer_id = r.id
            WHERE rt.package_id = $1
            ORDER BY rs.submitted_at DESC
            LIMIT 10
        """, package_id)
        
        return {
            "package_id": package_id,
            "package_name": quality["package_name"],
            "supplier": quality["supplier_name"],
            "scores": {
                "overall_rating": float(quality["overall_rating"]),
                "quality": float(quality["avg_quality_score"]),
                "timeliness": float(quality["avg_timeliness_score"]),
                "schema_compliance": float(quality["avg_schema_score"])
            },
            "total_reviews": quality["total_reviews"],
            "last_reviewed": quality["last_reviewed"].isoformat() if quality["last_reviewed"] else None,
            "trend": quality["quality_trend"],
            "recent_reviews": [
                {
                    "rating": r["overall_rating"],
                    "reviewer": r["reviewer_name"],
                    "findings": r["findings"][:200] + "..." if len(r["findings"]) > 200 else r["findings"],
                    "date": r["submitted_at"].isoformat()
                }
                for r in recent_reviews
            ]
        }

@api.post("/admin/create-review-task")
async def create_review_task(
    package_id: int,
    task_type: str,
    reward_pool: float = 0.05,
    required_reviews: int = 3
):
    """Admin endpoint to manually create review tasks"""
    async with db_pool.acquire() as conn:
        # Get package info for reference query
        package = await conn.fetchrow("""
            SELECT * FROM data_packages WHERE id = $1
        """, package_id)
        
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        
        reference_query = {
            "endpoint": package["endpoint_url"],
            "task_type": task_type,
            "package_category": package["category"]
        }
        
        task_id = await conn.fetchval("""
            INSERT INTO review_tasks (package_id, task_type, required_reviews, reward_pool_usd, reference_query, created_by)
            VALUES ($1, $2, $3, $4, $5, 'manual')
            RETURNING id
        """, package_id, task_type, required_reviews, reward_pool, json.dumps(reference_query))
        
        return {
            "task_id": task_id,
            "status": "created",
            "package": package["name"],
            "reward_pool": reward_pool
        }

# Original SquidPro Endpoints

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

async def update_balances(supplier_amt: float, reviewer_pool: float, squidpro_amt: float, supplier_id: str = "1"):
    """Update balances for supplier, reviewer pool, and squidpro treasury"""
    async with db_pool.acquire() as conn:
        # Update supplier balance by ID
        await conn.execute("""
            INSERT INTO balances (user_type, user_id, balance_usd) 
            VALUES ('supplier', $1, $2)
            ON CONFLICT (user_type, user_id) 
            DO UPDATE SET balance_usd = balances.balance_usd + $2
        """, supplier_id, supplier_amt)
        
        await conn.execute("""
            INSERT INTO balances (user_type, user_id, balance_usd) 
            VALUES ('reviewer', 'demo_reviewer_pool', $1)
            ON CONFLICT (user_type, user_id) 
            DO UPDATE SET balance_usd = balances.balance_usd + $1
        """, reviewer_pool)
        
        await conn.execute("""
            INSERT INTO balances (user_type, user_id, balance_usd) 
            VALUES ('squidpro', 'treasury', $1)
            ON CONFLICT (user_type, user_id) 
            DO UPDATE SET balance_usd = balances.balance_usd + $1
        """, squidpro_amt)

@api.get("/data/package/{package_id}")
async def query_package_data(package_id: int, Authorization: Optional[str] = Header(None)):
    """Query data from a specific package"""
    claims = _auth(Authorization)
    if claims.get("scope") != "data.read.price":
        raise HTTPException(status_code=403, detail="Scope not allowed for this endpoint")
    
    async with db_pool.acquire() as conn:
        # Get package details
        package = await conn.fetchrow("""
            SELECT p.*, s.id as supplier_id
            FROM data_packages p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = $1 AND p.status = 'active' AND s.status = 'active'
        """, package_id)
        
        if not package:
            raise HTTPException(status_code=404, detail="Package not found or inactive")
        
        # Call the package's endpoint
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(package["endpoint_url"])
        
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Package endpoint error")
        
        data = r.json()
        
        # Calculate payout splits using package pricing
        price = float(package["price_per_query"])
        supplier_amt = round(price * SPLIT_SUPPLIER, 6)
        reviewer_pool = round(price * SPLIT_REVIEWER, 6)
        squidpro_amt = round(price * SPLIT_SQUIDPRO, 6)
        
        # Update balances
        await update_balances(supplier_amt, reviewer_pool, squidpro_amt, str(package["supplier_id"]))
        
        # Log the query
        await conn.execute("""
            INSERT INTO query_history (package_id, agent_id, response_size, cost, trace_id)
            VALUES ($1, $2, $3, $4, $5)
        """, package_id, claims["sub"], len(str(data)), price, claims["trace_id"])
        
        receipt = {
            "trace_id": claims["trace_id"],
            "package_id": package_id,
            "package_name": package["name"],
            "ts": int(time.time()),
            "data": data,
            "cost": price,
            "payout": {"supplier": supplier_amt, "reviewer_pool": reviewer_pool, "squidpro": squidpro_amt}
        }
        return JSONResponse(receipt)

@api.get("/data/price")
async def get_price(pair: str = Query("BTCUSDT"), Authorization: Optional[str] = Header(None)):
    """Legacy price endpoint - queries the first crypto package"""
    claims = _auth(Authorization)
    if claims.get("scope") != "data.read.price":
        raise HTTPException(status_code=403, detail="Scope not allowed for this endpoint")
    
    # Find first crypto price package
    async with db_pool.acquire() as conn:
        package = await conn.fetchrow("""
            SELECT p.*, s.id as supplier_id
            FROM data_packages p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.category = 'financial' AND p.tags && ARRAY['crypto', 'prices']
            AND p.status = 'active' AND s.status = 'active'
            ORDER BY p.created_at
            LIMIT 1
        """)
    
    if not package:
        # Fallback to original collector
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{COLLECTOR}/price", params={"pair": pair})
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Collector error")
        data = r.json()
        
        # Use default pricing and supplier
        await update_balances(
            round(PRICE * SPLIT_SUPPLIER, 6),
            round(PRICE * SPLIT_REVIEWER, 6), 
            round(PRICE * SPLIT_SQUIDPRO, 6),
            "1"
        )
        
        receipt = {
            "trace_id": claims["trace_id"],
            "pair": pair,
            "ts": int(time.time()),
            "price": data["price"],
            "volume": data["volume"],
            "cost": PRICE,
            "payout": {
                "supplier": round(PRICE * SPLIT_SUPPLIER, 6),
                "reviewer_pool": round(PRICE * SPLIT_REVIEWER, 6),
                "squidpro": round(PRICE * SPLIT_SQUIDPRO, 6)
            }
        }
        return JSONResponse(receipt)
    
    # Use package system
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(package["endpoint_url"], params={"pair": pair})
    
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Package endpoint error")
    
    data = r.json()
    price = float(package["price_per_query"])
    supplier_amt = round(price * SPLIT_SUPPLIER, 6)
    reviewer_pool = round(price * SPLIT_REVIEWER, 6)
    squidpro_amt = round(price * SPLIT_SQUIDPRO, 6)
    
    await update_balances(supplier_amt, reviewer_pool, squidpro_amt, str(package["supplier_id"]))
    
    receipt = {
        "trace_id": claims["trace_id"],
        "pair": pair,
        "ts": int(time.time()),
        "price": data["price"],
        "volume": data["volume"],
        "cost": price,
        "payout": {"supplier": supplier_amt, "reviewer_pool": reviewer_pool, "squidpro": squidpro_amt}
    }
    return JSONResponse(receipt)

@api.get("/balances")
async def get_balances():
    """Get all current balances - useful for monitoring"""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_type, user_id, balance_usd FROM balances ORDER BY user_type, user_id")
        return [{"type": row["user_type"], "id": row["user_id"], "balance": float(row["balance_usd"])} for row in rows]

@api.get("/balances/{user_type}/{user_id}")
async def get_balance(user_type: str, user_id: str):
    """Get balance for specific user"""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT balance_usd, payout_threshold_usd FROM balances WHERE user_type = $1 AND user_id = $2",
            user_type, user_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "user_type": user_type,
            "user_id": user_id,
            "balance": float(row["balance_usd"]),
            "payout_threshold": float(row["payout_threshold_usd"])
        }

# Supplier Management Endpoints

@api.post("/suppliers/register")
async def register_supplier(supplier: SupplierRegistration):
    """Register a new data supplier"""
    async with db_pool.acquire() as conn:
        # Generate API key
        api_key = f"sup_{secrets.token_urlsafe(16)}"
        
        # Insert supplier
        supplier_id = await conn.fetchval("""
            INSERT INTO suppliers (name, email, stellar_address, api_key)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        """, supplier.name, supplier.email, supplier.stellar_address, api_key)
        
        # Create balance entry
        await conn.execute("""
            INSERT INTO balances (user_type, user_id, payout_threshold_usd)
            VALUES ('supplier', $1, 25.00)
        """, str(supplier_id))
        
        return {
            "supplier_id": supplier_id,
            "api_key": api_key,
            "status": "registered",
            "message": "Supplier registered successfully. Save your API key securely."
        }

async def authenticate_supplier(api_key: str):
    """Authenticate supplier by API key"""
    if not api_key or not api_key.startswith('sup_'):
        raise HTTPException(status_code=401, detail="Invalid supplier API key")
    
    async with db_pool.acquire() as conn:
        supplier = await conn.fetchrow("""
            SELECT id, name, status FROM suppliers WHERE api_key = $1 AND status = 'active'
        """, api_key)
        
        if not supplier:
            raise HTTPException(status_code=401, detail="Invalid or inactive supplier")
        
        return supplier

@api.get("/suppliers/me")
async def get_supplier_info(x_api_key: Optional[str] = Header(None)):
    """Get supplier information"""
    supplier = await authenticate_supplier(x_api_key)
    
    async with db_pool.acquire() as conn:
        # Get supplier details and package count
        supplier_info = await conn.fetchrow("""
            SELECT s.*, 
                   COUNT(p.id) as package_count,
                   b.balance_usd,
                   b.payout_threshold_usd
            FROM suppliers s
            LEFT JOIN data_packages p ON s.id = p.supplier_id
            LEFT JOIN balances b ON s.id::text = b.user_id AND b.user_type = 'supplier'
            WHERE s.id = $1
            GROUP BY s.id, b.balance_usd, b.payout_threshold_usd
        """, supplier["id"])
        
        return {
            "id": supplier_info["id"],
            "name": supplier_info["name"],
            "email": supplier_info["email"],
            "stellar_address": supplier_info["stellar_address"],
            "status": supplier_info["status"],
            "package_count": supplier_info["package_count"] or 0,
            "balance": float(supplier_info["balance_usd"] or 0),
            "payout_threshold": float(supplier_info["payout_threshold_usd"] or 25.00),
            "created_at": supplier_info["created_at"].isoformat()
        }

@api.post("/suppliers/packages")
async def create_package(package: DataPackage, x_api_key: Optional[str] = Header(None)):
    """Create a new data package"""
    supplier = await authenticate_supplier(x_api_key)
    
    async with db_pool.acquire() as conn:
        package_id = await conn.fetchval("""
            INSERT INTO data_packages (
                supplier_id, name, description, category, endpoint_url,
                price_per_query, sample_data, schema_definition, rate_limit, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        """, supplier["id"], package.name, package.description, package.category,
        package.endpoint_url, package.price_per_query, package.sample_data,
        package.schema_definition, package.rate_limit, package.tags)
        
        return {
            "package_id": package_id,
            "status": "created",
            "message": "Data package created successfully"
        }

@api.get("/packages")
async def list_packages(category: Optional[str] = None, tag: Optional[str] = None):
    """List all available data packages"""
    async with db_pool.acquire() as conn:
        query = """
            SELECT p.*, s.name as supplier_name
            FROM data_packages p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.status = 'active' AND s.status = 'active'
        """
        params = []
        
        if category:
            query += " AND p.category = $1"
            params.append(category)
        
        if tag:
            query += f" AND ${'2' if category else '1'} = ANY(p.tags)"
            params.append(tag)
        
        query += " ORDER BY p.created_at DESC"
        
        packages = await conn.fetch(query, *params)
        
        return [
            {
                "id": pkg["id"],
                "name": pkg["name"],
                "description": pkg["description"],
                "category": pkg["category"],
                "supplier": pkg["supplier_name"],
                "price_per_query": float(pkg["price_per_query"]),
                "sample_data": pkg["sample_data"],
                "tags": pkg["tags"],
                "rate_limit": pkg["rate_limit"]
            }
            for pkg in packages
        ]

@api.get("/packages/{package_id}")
async def get_package(package_id: int):
    """Get detailed package information"""
    async with db_pool.acquire() as conn:
        package = await conn.fetchrow("""
            SELECT p.*, s.name as supplier_name
            FROM data_packages p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = $1 AND p.status = 'active' AND s.status = 'active'
        """, package_id)
        
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        
        return {
            "id": package["id"],
            "name": package["name"],
            "description": package["description"],
            "category": package["category"],
            "supplier": package["supplier_name"],
            "price_per_query": float(package["price_per_query"]),
            "sample_data": package["sample_data"],
            "schema_definition": package["schema_definition"],
            "tags": package["tags"],
            "rate_limit": package["rate_limit"],
            "created_at": package["created_at"].isoformat()
        }

# Stellar Payment Functions

async def send_stellar_payment(recipient_address: str, amount_usd: float) -> str:
    """Send XLM payment via Stellar and return transaction hash"""
    if not stellar_keypair:
        raise Exception("Stellar not properly initialized")
    
    try:
        # Get account info
        source_account = stellar_server.load_account(stellar_keypair.public_key)
        
        # Build transaction
        transaction = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE if STELLAR_NETWORK == "testnet" else Network.PUBLIC_NETWORK_PASSPHRASE,
                base_fee=100,  # 100 stroops base fee
            )
            .add_text_memo(f"SquidPro payout ${amount_usd:.6f}")
            .append_payment_op(
                destination=recipient_address,
                asset=Asset.native(),  # Use native XLM
                amount=str(amount_usd)
            )
            .set_timeout(30)
            .build()
        )
        
        # Sign and submit
        transaction.sign(stellar_keypair)
        response = stellar_server.submit_transaction(transaction)
        
        return response["hash"]
        
    except SdkError as e:
        logging.error(f"Stellar payment failed: {e}")
        raise Exception(f"Payment failed: {str(e)}")
    except Exception as e:
        logging.error(f"Unexpected payment error: {e}")
        raise Exception(f"Payment failed: {str(e)}")

async def get_user_stellar_address(conn, user_type: str, user_id: str) -> Optional[str]:
    """Get user's Stellar address from database"""
    if user_type == "supplier":
        row = await conn.fetchrow("SELECT stellar_address FROM suppliers WHERE id = $1", int(user_id))
    elif user_type == "reviewer":
        row = await conn.fetchrow("SELECT stellar_address FROM reviewers WHERE id = $1", int(user_id))
    else:
        return None
    
    return row["stellar_address"] if row else None

async def process_payouts():
    """Check for accounts ready for payout and process them"""
    if not stellar_keypair:
        logging.warning("Stellar not initialized, skipping payouts")
        return {"processed": 0, "message": "Stellar not configured"}
    
    async with db_pool.acquire() as conn:
        # Find accounts eligible for payout
        eligible_accounts = await conn.fetch("""
            SELECT user_type, user_id, balance_usd, payout_threshold_usd
            FROM balances 
            WHERE balance_usd >= payout_threshold_usd AND balance_usd > 0
        """)
        
        processed = 0
        results = []
        
        for account in eligible_accounts:
            user_type = account["user_type"]
            user_id = account["user_id"]
            balance = float(account["balance_usd"])
            
            # Skip SquidPro treasury (we don't pay ourselves out)
            if user_type == "squidpro":
                continue
                
            # Get recipient address
            recipient_address = await get_user_stellar_address(conn, user_type, user_id)
            if not recipient_address:
                results.append({
                    "user": f"{user_type}/{user_id}",
                    "status": "skipped",
                    "reason": "No Stellar address on file"
                })
                continue
            
            try:
                # Send payment
                tx_hash = await send_stellar_payment(recipient_address, balance)
                
                # Record successful payout
                await conn.execute("""
                    INSERT INTO payout_history (stellar_tx_hash, recipient_address, amount_usd, user_type, user_id)
                    VALUES ($1, $2, $3, $4, $5)
                """, tx_hash, recipient_address, balance, user_type, user_id)
                
                # Zero out balance
                await conn.execute("""
                    UPDATE balances SET balance_usd = 0 WHERE user_type = $1 AND user_id = $2
                """, user_type, user_id)
                
                processed += 1
                results.append({
                    "user": f"{user_type}/{user_id}",
                    "amount": balance,
                    "tx_hash": tx_hash,
                    "status": "success"
                })
                
                logging.info(f"Paid out ${balance} to {user_type}/{user_id} - TX: {tx_hash}")
                
            except Exception as e:
                results.append({
                    "user": f"{user_type}/{user_id}",
                    "status": "failed",
                    "error": str(e)
                })
                logging.error(f"Payout failed for {user_type}/{user_id}: {e}")
        
        return {"processed": processed, "results": results}

@api.post("/admin/process-payouts")
async def trigger_payouts():
    """Manually trigger payout processing (admin endpoint)"""
    result = await process_payouts()
    return result

@api.get("/payout-history")
async def get_payout_history():
    """Get recent payout history"""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT stellar_tx_hash, recipient_address, amount_usd, user_type, user_id, created_at
            FROM payout_history 
            ORDER BY created_at DESC 
            LIMIT 50
        """)
        return [
            {
                "tx_hash": row["stellar_tx_hash"],
                "recipient": row["recipient_address"],
                "amount": float(row["amount_usd"]),
                "user": f"{row['user_type']}/{row['user_id']}",
                "timestamp": row["created_at"].isoformat()
            }
            for row in rows
        ]

@api.get("/stellar/info")
async def stellar_info():
    """Get Stellar configuration info"""
    if not stellar_keypair:
        return {"status": "not_configured", "message": "Stellar not initialized"}
    
    return {
        "status": "configured",
        "public_key": stellar_keypair.public_key,
        "network": STELLAR_NETWORK,
        "payment_asset": "XLM (native)"
    }


# Add these enhanced endpoints to your squidpro-api/app.py

@api.get("/users/me/detailed")
async def get_detailed_profile(x_api_key: Optional[str] = Header(None)):
    """Get comprehensive user profile with all ecosystem data"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    async with db_pool.acquire() as conn:
        # Try reviewer first
        if x_api_key.startswith('rev_'):
            reviewer = await conn.fetchrow("""
                SELECT r.*, rs.*, b.balance_usd
                FROM reviewers r
                LEFT JOIN reviewer_stats rs ON r.id = rs.reviewer_id
                LEFT JOIN balances b ON r.id::text = b.user_id AND b.user_type = 'reviewer'
                WHERE r.api_key = $1
            """, x_api_key)
            
            if not reviewer:
                raise HTTPException(status_code=401, detail="Invalid API key")
            
            # Get review history
            review_history = await conn.fetch("""
                SELECT rt.id as task_id, rt.task_type, rt.reward_pool_usd,
                       rs.overall_rating, rs.payout_earned, rs.is_consensus,
                       rs.submitted_at, dp.name as package_name, s.name as supplier_name
                FROM review_submissions rs
                JOIN review_tasks rt ON rs.task_id = rt.id
                JOIN data_packages dp ON rt.package_id = dp.id
                JOIN suppliers s ON dp.supplier_id = s.id
                WHERE rs.reviewer_id = $1
                ORDER BY rs.submitted_at DESC
                LIMIT 50
            """, reviewer["id"])
            
            # Get earnings by month
            monthly_earnings = await conn.fetch("""
                SELECT DATE_TRUNC('month', rs.submitted_at) as month,
                       SUM(rs.payout_earned) as earnings,
                       COUNT(*) as reviews
                FROM review_submissions rs
                WHERE rs.reviewer_id = $1 AND rs.payout_earned > 0
                GROUP BY month
                ORDER BY month DESC
                LIMIT 12
            """, reviewer["id"])
            
            # Get available tasks
            available_tasks = await conn.fetch("""
                SELECT rt.id, rt.task_type, rt.reward_pool_usd, rt.required_reviews,
                       dp.name as package_name, dp.category,
                       (rt.required_reviews - COALESCE(submitted_count.count, 0)) as spots_remaining
                FROM review_tasks rt
                JOIN data_packages dp ON rt.package_id = dp.id
                LEFT JOIN (
                    SELECT task_id, COUNT(*) as count 
                    FROM review_submissions 
                    GROUP BY task_id
                ) submitted_count ON rt.id = submitted_count.task_id
                WHERE rt.status = 'open' 
                AND rt.expires_at > NOW()
                AND rt.id NOT IN (
                    SELECT task_id FROM review_submissions WHERE reviewer_id = $1
                )
                AND (rt.required_reviews - COALESCE(submitted_count.count, 0)) > 0
                ORDER BY rt.reward_pool_usd DESC
                LIMIT 20
            """, reviewer["id"])
            
            return {
                "user": {
                    "id": reviewer["id"],
                    "name": reviewer["name"],
                    "email": reviewer.get("email"),
                    "type": "reviewer",
                    "stellar_address": reviewer["stellar_address"],
                    "roles": ["buyer", "reviewer"],
                    "reputation_level": reviewer["reputation_level"] or "novice",
                    "created_at": reviewer["created_at"].isoformat() if reviewer.get("created_at") else None
                },
                "balance": {
                    "current": float(reviewer["balance_usd"] or 0),
                    "lifetime_earned": float(reviewer["total_earned"] or 0),
                    "payout_threshold": 5.0
                },
                "stats": {
                    "total_reviews": reviewer["total_reviews"] or 0,
                    "consensus_rate": float(reviewer["consensus_rate"] or 0),
                    "accuracy_score": float(reviewer["accuracy_score"] or 0),
                    "avg_review_time": reviewer["avg_review_time_minutes"] or 0
                },
                "review_history": [
                    {
                        "task_id": r["task_id"],
                        "package_name": r["package_name"],
                        "supplier": r["supplier_name"],
                        "task_type": r["task_type"],
                        "rating_given": r["overall_rating"],
                        "earned": float(r["payout_earned"]) if r["payout_earned"] else 0,
                        "consensus": r["is_consensus"],
                        "date": r["submitted_at"].isoformat()
                    } for r in review_history
                ],
                "monthly_earnings": [
                    {
                        "month": r["month"].strftime("%Y-%m"),
                        "earnings": float(r["earnings"]),
                        "reviews": r["reviews"]
                    } for r in monthly_earnings
                ],
                "available_tasks": [
                    {
                        "id": t["id"],
                        "package_name": t["package_name"],
                        "category": t["category"],
                        "task_type": t["task_type"],
                        "reward": float(t["reward_pool_usd"]),
                        "spots_remaining": t["spots_remaining"]
                    } for t in available_tasks
                ]
            }
            
        # Try supplier
        elif x_api_key.startswith('sup_'):
            supplier = await conn.fetchrow("""
                SELECT s.*, b.balance_usd
                FROM suppliers s
                LEFT JOIN balances b ON s.id::text = b.user_id AND b.user_type = 'supplier'
                WHERE s.api_key = $1 AND s.status = 'active'
            """, x_api_key)
            
            if not supplier:
                raise HTTPException(status_code=401, detail="Invalid API key")
                
            # Get supplier packages with performance
            packages = await conn.fetch("""
                SELECT dp.*, 
                       COUNT(qh.id) as total_queries,
                       SUM(qh.cost * 0.7) as total_revenue,
                       AVG(pqs.overall_rating) as avg_rating,
                       pqs.total_reviews
                FROM data_packages dp
                LEFT JOIN query_history qh ON dp.id = qh.package_id
                LEFT JOIN package_quality_scores pqs ON dp.id = pqs.package_id
                WHERE dp.supplier_id = $1
                GROUP BY dp.id, pqs.overall_rating, pqs.total_reviews
                ORDER BY total_revenue DESC NULLS LAST
            """, supplier["id"])
            
            # Get monthly revenue
            monthly_revenue = await conn.fetch("""
                SELECT DATE_TRUNC('month', qh.created_at) as month,
                       SUM(qh.cost * 0.7) as revenue,
                       COUNT(*) as queries
                FROM query_history qh
                JOIN data_packages dp ON qh.package_id = dp.id
                WHERE dp.supplier_id = $1
                GROUP BY month
                ORDER BY month DESC
                LIMIT 12
            """, supplier["id"])
            
            # Get recent usage
            recent_usage = await conn.fetch("""
                SELECT qh.created_at, qh.agent_id, qh.cost, dp.name as package_name,
                       qh.trace_id
                FROM query_history qh
                JOIN data_packages dp ON qh.package_id = dp.id
                WHERE dp.supplier_id = $1
                ORDER BY qh.created_at DESC
                LIMIT 100
            """, supplier["id"])
            
            return {
                "user": {
                    "id": supplier["id"],
                    "name": supplier["name"],
                    "email": supplier["email"],
                    "type": "supplier",
                    "stellar_address": supplier["stellar_address"],
                    "roles": ["buyer", "supplier"],
                    "status": supplier["status"],
                    "created_at": supplier["created_at"].isoformat()
                },
                "balance": {
                    "current": float(supplier["balance_usd"] or 0),
                    "lifetime_earned": sum(float(r["total_revenue"] or 0) for r in packages),
                    "payout_threshold": 25.0
                },
                "packages": [
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "description": p["description"],
                        "category": p["category"],
                        "price": float(p["price_per_query"]),
                        "total_queries": p["total_queries"] or 0,
                        "total_revenue": float(p["total_revenue"] or 0),
                        "avg_rating": float(p["avg_rating"] or 0),
                        "total_reviews": p["total_reviews"] or 0,
                        "status": p["status"],
                        "created_at": p["created_at"].isoformat()
                    } for p in packages
                ],
                "monthly_revenue": [
                    {
                        "month": r["month"].strftime("%Y-%m"),
                        "revenue": float(r["revenue"]),
                        "queries": r["queries"]
                    } for r in monthly_revenue
                ],
                "recent_usage": [
                    {
                        "date": u["created_at"].isoformat(),
                        "agent_id": u["agent_id"],
                        "package_name": u["package_name"],
                        "revenue": float(u["cost"]) * 0.7,
                        "trace_id": u["trace_id"]
                    } for u in recent_usage
                ]
            }
        
        raise HTTPException(status_code=401, detail="Invalid API key")

@api.get("/users/me/payout-history")
async def get_payout_history(x_api_key: Optional[str] = Header(None)):
    """Get user's payout history"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    async with db_pool.acquire() as conn:
        user_id = None
        user_type = None
        
        if x_api_key.startswith('rev_'):
            reviewer = await conn.fetchval("SELECT id FROM reviewers WHERE api_key = $1", x_api_key)
            if reviewer:
                user_id = str(reviewer)
                user_type = 'reviewer'
        elif x_api_key.startswith('sup_'):
            supplier = await conn.fetchval("SELECT id FROM suppliers WHERE api_key = $1", x_api_key)
            if supplier:
                user_id = str(supplier)
                user_type = 'supplier'
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid API key")
            
        payouts = await conn.fetch("""
            SELECT stellar_tx_hash, amount_usd, created_at
            FROM payout_history
            WHERE user_type = $1 AND user_id = $2
            ORDER BY created_at DESC
            LIMIT 50
        """, user_type, user_id)
        
        return [
            {
                "tx_hash": p["stellar_tx_hash"],
                "amount": float(p["amount_usd"]),
                "date": p["created_at"].isoformat()
            } for p in payouts
        ]

@api.post("/users/me/update-payout-threshold")
async def update_payout_threshold(
    request: dict,
    x_api_key: Optional[str] = Header(None)
):
    """Update user's payout threshold"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    threshold = request.get("threshold")
    if not threshold or threshold < 0.01:
        raise HTTPException(status_code=400, detail="Invalid threshold")
    
    async with db_pool.acquire() as conn:
        user_id = None
        user_type = None
        
        if x_api_key.startswith('rev_'):
            reviewer = await conn.fetchval("SELECT id FROM reviewers WHERE api_key = $1", x_api_key)
            if reviewer:
                user_id = str(reviewer)
                user_type = 'reviewer'
        elif x_api_key.startswith('sup_'):
            supplier = await conn.fetchval("SELECT id FROM suppliers WHERE api_key = $1", x_api_key)
            if supplier:
                user_id = str(supplier)
                user_type = 'supplier'
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        await conn.execute("""
            UPDATE balances 
            SET payout_threshold_usd = $1
            WHERE user_type = $2 AND user_id = $3
        """, threshold, user_type, user_id)
        
        return {"success": True, "new_threshold": threshold}

@api.get("/users/me/api-usage")
async def get_api_usage_stats(x_api_key: Optional[str] = Header(None)):
    """Get API usage statistics"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
@api.get("/users/me")
async def get_unified_profile(x_api_key: Optional[str] = Header(None)):
    """Get unified user profile - works with current separate tables"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    async with db_pool.acquire() as conn:
        # Try reviewer first
        if x_api_key.startswith('rev_'):
            reviewer = await conn.fetchrow("""
                SELECT r.*, rs.*, b.balance_usd
                FROM reviewers r
                LEFT JOIN reviewer_stats rs ON r.id = rs.reviewer_id
                LEFT JOIN balances b ON r.id::text = b.user_id AND b.user_type = 'reviewer'
                WHERE r.api_key = $1
            """, x_api_key)
            
            if reviewer:
                return {
                    "id": reviewer["id"],
                    "name": reviewer["name"],
                    "email": reviewer.get("email"),
                    "type": "reviewer",
                    "stellar_address": reviewer["stellar_address"],
                    "roles": ["buyer", "reviewer"],
                    "balance": float(reviewer["balance_usd"] or 0),
                    "stats": {
                        "total_reviews": reviewer["total_reviews"] or 0,
                        "consensus_rate": float(reviewer["consensus_rate"] or 0),
                        "accuracy_score": float(reviewer["accuracy_score"] or 0),
                        "total_earned": float(reviewer["total_earned"] or 0)
                    },
                    "reputation_level": reviewer["reputation_level"] or "novice"
                }
        
        # Try supplier
        elif x_api_key.startswith('sup_'):
            supplier = await conn.fetchrow("""
                SELECT s.*, b.balance_usd,
                       COUNT(dp.id) as package_count
                FROM suppliers s
                LEFT JOIN balances b ON s.id::text = b.user_id AND b.user_type = 'supplier'
                LEFT JOIN data_packages dp ON s.id = dp.supplier_id
                WHERE s.api_key = $1 AND s.status = 'active'
                GROUP BY s.id, b.balance_usd
            """, x_api_key)
            
            if supplier:
                return {
                    "id": supplier["id"],
                    "name": supplier["name"],
                    "email": supplier["email"],
                    "type": "supplier", 
                    "stellar_address": supplier["stellar_address"],
                    "roles": ["buyer", "supplier"],
                    "balance": float(supplier["balance_usd"] or 0),
                    "package_count": supplier["package_count"] or 0,
                    "status": supplier["status"]
                }
        
        raise HTTPException(status_code=401, detail="Invalid API key")
