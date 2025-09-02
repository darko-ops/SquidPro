# Add these imports to the top of squidpro-api/app.py
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import secrets
import statistics

# Add these Pydantic models after your existing models
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

# Add these endpoints to your squidpro-api/app.py

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
        review.evidence)
        
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
        """, package_id, task_type, required_reviews, reward_pool, reference_query)
        
        return {
            "task_id": task_id,
            "status": "created",
            "package": package["name"],
            "reward_pool": reward_pool
        }