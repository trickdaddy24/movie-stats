from fastapi import APIRouter
import database as db

router = APIRouter()


@router.get("/stats")
def get_stats():
    with db.get_db() as conn:
        # 1. Overview
        overview = conn.execute(
            """
            SELECT
                COUNT(*) as total_movies,
                ROUND(SUM(COALESCE(runtime, 0)) / 60.0, 1) as total_hours,
                ROUND(AVG(CASE WHEN rating > 0 THEN rating END), 2) as avg_rating,
                ROUND(AVG(CASE WHEN runtime > 0 THEN runtime END), 0) as avg_runtime,
                COUNT(CASE WHEN source='plex' THEN 1 END) as plex_count,
                COUNT(CASE WHEN source='manual' THEN 1 END) as manual_count
            FROM movies WHERE status='active'
            """
        ).fetchone()

        # 2. Genres (top 15)
        genres = conn.execute(
            """
            SELECT g.name, COUNT(*) as count
            FROM genres g JOIN movies m ON g.movie_id = m.id
            WHERE m.status='active'
            GROUP BY g.name ORDER BY count DESC LIMIT 15
            """
        ).fetchall()

        # 3. Decades
        decades = conn.execute(
            """
            SELECT (CAST(SUBSTR(release_date,1,4) AS INTEGER)/10)*10 as decade,
                   COUNT(*) as count
            FROM movies
            WHERE release_date IS NOT NULL AND LENGTH(release_date) >= 4 AND status='active'
            GROUP BY decade ORDER BY decade
            """
        ).fetchall()

        # 4. Rating distribution
        ratings = conn.execute(
            """
            SELECT
              CASE
                WHEN rating IS NULL OR rating = 0 THEN 'N/A'
                WHEN rating < 4 THEN '1–4'
                WHEN rating < 5 THEN '4–5'
                WHEN rating < 6 THEN '5–6'
                WHEN rating < 7 THEN '6–7'
                WHEN rating < 8 THEN '7–8'
                WHEN rating < 9 THEN '8–9'
                ELSE '9–10'
              END as bucket,
              COUNT(*) as count
            FROM movies WHERE status='active'
            GROUP BY bucket ORDER BY bucket
            """
        ).fetchall()

        # 5. Content ratings
        content = conn.execute(
            """
            SELECT COALESCE(content_rating, 'N/A') as rating, COUNT(*) as count
            FROM movies WHERE status='active'
            GROUP BY rating ORDER BY count DESC LIMIT 8
            """
        ).fetchall()

        # 6. Added over time (monthly)
        over_time = conn.execute(
            """
            SELECT SUBSTR(added_at, 1, 7) as month, COUNT(*) as count
            FROM movies WHERE added_at IS NOT NULL AND status='active'
            GROUP BY month ORDER BY month
            """
        ).fetchall()

        # 7. Top rated (min 100 votes)
        top_rated = conn.execute(
            """
            SELECT title, rating, release_date, runtime
            FROM movies
            WHERE rating IS NOT NULL AND vote_count >= 100 AND status='active'
            ORDER BY rating DESC LIMIT 5
            """
        ).fetchall()

        return {
            "overview": dict(overview) if overview else {},
            "genres": [dict(r) for r in genres],
            "decades": [{"decade": f"{r['decade']}s", "count": r["count"]} for r in decades],
            "rating_distribution": [dict(r) for r in ratings],
            "content_ratings": [dict(r) for r in content],
            "added_over_time": [dict(r) for r in over_time],
            "top_rated": [dict(r) for r in top_rated],
        }
