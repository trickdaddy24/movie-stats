from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
import tmdb
import fanart
import database as db

router = APIRouter()


@router.get("/search")
def search_tmdb(q: str = Query(..., min_length=1), page: int = Query(1, ge=1)):
    results = tmdb.search_movies(q, page)
    return results


@router.get("/search/tmdb/{tmdb_id}")
def get_tmdb_movie(tmdb_id: int):
    try:
        movie = tmdb.get_movie(tmdb_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB error: {e}")

    if movie.get("imdb_id"):
        fanart_art = fanart.get_movie_art_flat(tmdb_id)
    else:
        fanart_art = fanart.get_movie_art_flat(tmdb_id)

    movie["fanart"] = fanart_art

    saved = db.get_movie_by_tmdb_id(tmdb_id)
    movie["in_library"] = saved is not None
    if saved:
        movie["library_id"] = saved["id"]

    return movie


@router.get("/search/imdb/{imdb_id}")
def get_by_imdb(imdb_id: str):
    result = tmdb.get_by_imdb_id(imdb_id)
    if not result:
        raise HTTPException(status_code=404, detail="Movie not found via IMDb ID")
    saved = db.get_movie_by_tmdb_id(result["tmdb_id"])
    result["in_library"] = saved is not None
    if saved:
        result["library_id"] = saved["id"]
    return result


@router.post("/search/add/{tmdb_id}")
def add_movie_to_library(tmdb_id: int):
    existing = db.get_movie_by_tmdb_id(tmdb_id)
    if existing:
        full = db.get_movie_full(existing["id"])
        full["already_existed"] = True
        return full

    try:
        movie_data = tmdb.get_movie(tmdb_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB error: {e}")

    fanart_art = fanart.get_movie_art_flat(tmdb_id)

    save_data = {
        "tmdb_id": movie_data["tmdb_id"],
        "imdb_id": movie_data.get("imdb_id"),
        "title": movie_data["title"],
        "original_title": movie_data.get("original_title"),
        "overview": movie_data.get("overview"),
        "release_date": movie_data.get("release_date"),
        "runtime": movie_data.get("runtime"),
        "rating": movie_data.get("rating"),
        "vote_count": movie_data.get("vote_count"),
        "tagline": movie_data.get("tagline"),
        "status": "active",
        "added_at": datetime.now(timezone.utc).isoformat(),
    }

    movie_id = db.add_movie(save_data)

    db.add_cast_crew(movie_id, movie_data.get("cast", []) + movie_data.get("crew", []))
    db.add_genres(movie_id, movie_data.get("genres", []))

    all_artwork = movie_data.get("artwork", []) + fanart_art
    db.add_artwork(movie_id, all_artwork)

    ext = movie_data.get("external_ids", {})
    if movie_data.get("imdb_id"):
        db.add_external_id(movie_id, "imdb", movie_data["imdb_id"])
    db.add_external_id(movie_id, "tmdb", str(tmdb_id))
    if ext.get("wikidata_id"):
        db.add_external_id(movie_id, "wikidata", ext["wikidata_id"])
    if ext.get("facebook_id"):
        db.add_external_id(movie_id, "facebook", ext["facebook_id"])
    if ext.get("instagram_id"):
        db.add_external_id(movie_id, "instagram", ext["instagram_id"])
    if ext.get("twitter_id"):
        db.add_external_id(movie_id, "twitter", ext["twitter_id"])

    full = db.get_movie_full(movie_id)
    full["already_existed"] = False
    return full
