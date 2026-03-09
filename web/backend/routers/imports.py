from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import tmdb
import fanart
import database as db
import trakt as trakt_client
import plex as plex_client

router = APIRouter(prefix="/import")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_tmdb_list_url(list_id: str) -> str:
    """Accept either a raw integer string or a full TMDB list URL."""
    prefix = "https://www.themoviedb.org/list/"
    val = list_id.strip()
    if val.startswith(prefix):
        val = val[len(prefix):]
    # strip any trailing slashes or query params
    val = val.split("/")[0].split("?")[0]
    return val


def _import_single_movie(tmdb_id: int) -> str | None:
    """
    Import one movie by TMDB ID. Returns None on success, error message string on failure.
    Caller is responsible for checking if already in DB before calling this.
    """
    try:
        movie_data = tmdb.get_movie(tmdb_id)
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

        return None
    except Exception as e:
        return str(e)


def _bulk_import(movies: list[dict]) -> dict:
    """
    movies: list of {tmdb_id, title, ...}
    Returns {imported, skipped, failed, errors}
    """
    imported = 0
    skipped = 0
    failed = 0
    errors: list[str] = []

    for movie in movies:
        tmdb_id = movie.get("tmdb_id")
        title = movie.get("title", str(tmdb_id))

        if not tmdb_id:
            failed += 1
            errors.append(f"No TMDB ID for '{title}'")
            continue

        existing = db.get_movie_by_tmdb_id(tmdb_id)
        if existing:
            skipped += 1
            continue

        err = _import_single_movie(tmdb_id)
        if err:
            failed += 1
            errors.append(f"'{title}' (TMDB {tmdb_id}): {err}")
        else:
            imported += 1

    return {"imported": imported, "skipped": skipped, "failed": failed, "errors": errors}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class TraktImportBody(BaseModel):
    username: str
    list_slug: Optional[str] = None


class PlexLibrariesBody(BaseModel):
    plex_url: str
    plex_token: str


class PlexPreviewBody(BaseModel):
    plex_url: str
    plex_token: str
    section_key: str


class PlexImportBody(BaseModel):
    plex_url: str
    plex_token: str
    section_key: str


# ---------------------------------------------------------------------------
# TMDB List endpoints
# ---------------------------------------------------------------------------

@router.get("/tmdb-list/{list_id}")
def preview_tmdb_list(list_id: str):
    """Preview a TMDB list — returns name, description, total and first 5 movies."""
    clean_id = _strip_tmdb_list_url(list_id)
    try:
        data = tmdb._get(f"/list/{clean_id}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB error: {e}")

    items = data.get("items", [])
    movies = []
    for item in items:
        movies.append({
            "tmdb_id": item.get("id"),
            "title": item.get("title", ""),
            "year": item.get("release_date", "")[:4] if item.get("release_date") else None,
            "poster_url": tmdb.image_url(item.get("poster_path", ""), tmdb.SIZE_POSTER),
        })

    return {
        "list_name": data.get("name", ""),
        "description": data.get("description", ""),
        "total": len(movies),
        "movies": movies,
    }


@router.post("/tmdb-list/{list_id}")
def import_tmdb_list(list_id: str):
    """Import all movies from a TMDB list into the local library."""
    clean_id = _strip_tmdb_list_url(list_id)
    try:
        data = tmdb._get(f"/list/{clean_id}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB error: {e}")

    items = data.get("items", [])
    movies = [
        {"tmdb_id": item.get("id"), "title": item.get("title", "")}
        for item in items
    ]

    return _bulk_import(movies)


# ---------------------------------------------------------------------------
# Trakt endpoints
# ---------------------------------------------------------------------------

@router.get("/trakt/preview")
def preview_trakt(
    username: str = Query(...),
    list_slug: Optional[str] = Query(None),
):
    """Preview a Trakt user list or watchlist."""
    if not trakt_client.get_client_id():
        raise HTTPException(
            status_code=400,
            detail="TRAKT_CLIENT_ID not configured — add it to .env",
        )

    try:
        if list_slug:
            movies = trakt_client.get_user_list(username, list_slug)
        else:
            movies = trakt_client.get_watchlist(username)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Trakt error: {e}")

    return {
        "total": len(movies),
        "movies": movies[:5],
    }


@router.post("/trakt")
def import_trakt(body: TraktImportBody):
    """Bulk import movies from a Trakt list or watchlist."""
    if not trakt_client.get_client_id():
        raise HTTPException(
            status_code=400,
            detail="TRAKT_CLIENT_ID not configured — add it to .env",
        )

    try:
        if body.list_slug:
            movies = trakt_client.get_user_list(body.username, body.list_slug)
        else:
            movies = trakt_client.get_watchlist(body.username)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Trakt error: {e}")

    return _bulk_import(movies)


# ---------------------------------------------------------------------------
# Plex endpoints
# ---------------------------------------------------------------------------

@router.post("/plex/libraries")
def get_plex_libraries(body: PlexLibrariesBody):
    """Connect to Plex and return available movie library sections."""
    if not plex_client.validate_connection(body.plex_url, body.plex_token):
        raise HTTPException(status_code=502, detail="Cannot connect to Plex server. Check URL and token.")

    try:
        libraries = plex_client.get_libraries(body.plex_url, body.plex_token)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Plex error: {e}")

    return libraries


@router.post("/plex/preview")
def preview_plex(body: PlexPreviewBody):
    """Preview movies in a Plex library section."""
    try:
        movies = plex_client.get_library_movies(body.plex_url, body.plex_token, body.section_key)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Plex error: {e}")

    preview_movies = [
        {"tmdb_id": m.get("tmdb_id"), "title": m.get("title"), "year": m.get("year")}
        for m in movies[:5]
    ]

    return {
        "total": len(movies),
        "movies": preview_movies,
    }


@router.post("/plex")
def import_plex(body: PlexImportBody):
    """Bulk import all movies from a Plex library section."""
    try:
        movies = plex_client.get_library_movies(body.plex_url, body.plex_token, body.section_key)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Plex error: {e}")

    # Filter out any without a resolved TMDB ID
    importable = [m for m in movies if m.get("tmdb_id")]
    unresolved = [m for m in movies if not m.get("tmdb_id")]

    result = _bulk_import(importable)

    if unresolved:
        result["failed"] += len(unresolved)
        for m in unresolved:
            result["errors"].append(f"'{m.get('title')}': could not resolve TMDB ID")

    return result
