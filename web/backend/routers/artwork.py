import logging
from fastapi import APIRouter, HTTPException
import database as db
import fanart
import tmdb
from tmdb import TMDBRateLimitError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/movies/{movie_id}/artwork")
def get_artwork(movie_id: int):
    movie = db.get_movie_by_id(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    with db.get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM artwork WHERE movie_id=? ORDER BY likes DESC",
            (movie_id,),
        ).fetchall()
        return [dict(r) for r in rows]


@router.get("/movies/{movie_id}/artwork/refresh")
def refresh_artwork(movie_id: int):
    movie = db.get_movie_by_id(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    tmdb_id = movie["tmdb_id"]

    try:
        movie_data = tmdb.get_movie(tmdb_id)
        tmdb_artwork = movie_data.get("artwork", [])
    except TMDBRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e), headers={"Retry-After": str(e.retry_after)})
    except Exception as e:
        logger.warning("TMDB error during artwork refresh for tmdb_id=%s: %s", tmdb_id, e)
        tmdb_artwork = []

    fanart_art = fanart.get_movie_art_flat(tmdb_id)

    all_artwork = tmdb_artwork + fanart_art
    db.add_artwork(movie_id, all_artwork)

    with db.get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM artwork WHERE movie_id=? ORDER BY likes DESC",
            (movie_id,),
        ).fetchall()
        return {
            "success": True,
            "movie_id": movie_id,
            "artwork_count": len(rows),
            "artwork": [dict(r) for r in rows],
        }
