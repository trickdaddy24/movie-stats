import asyncio
import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import database as db
import fanart
import plex as plex_client
import scanner
import tmdb
from tmdb import TMDBRateLimitError
import trakt as trakt_client

# ---------------------------------------------------------------------------
# File logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    filename="import.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("import")

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------

_jobs: dict[str, dict] = {}
_job_events: dict[str, list[dict]] = {}

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
    val = val.split("/")[0].split("?")[0]
    return val


def _new_job(source: str) -> str:
    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"done": False, "source": source}
    _job_events[job_id] = []
    return job_id


def _import_single_movie(tmdb_id: int) -> None:
    """Import one movie by TMDB ID. Raises on failure."""
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


def _run_import(job_id: str, movies_to_import: list[dict], source: str, source_detail: str) -> None:
    """Generic import runner — called from threading.Thread."""
    log_entries: list[dict] = []
    imported = skipped = failed = 0
    start = time.time()

    _job_events[job_id].append({"type": "start", "total": len(movies_to_import), "source": source})

    session_id = db.create_import_session(source, source_detail)

    for i, movie in enumerate(movies_to_import, 1):
        try:
            tmdb_id = movie.get("tmdb_id")
            title = movie.get("title", f"TMDB {tmdb_id}")

            if not tmdb_id:
                failed += 1
                log.error(f"[{source}] failed: no tmdb_id for '{title}'")
                _job_events[job_id].append({
                    "type": "progress", "current": i, "total": len(movies_to_import),
                    "title": title, "status": "failed",
                })
                log_entries.append({"title": title, "status": "failed"})
                continue

            if db.get_movie_by_tmdb_id(tmdb_id):
                status = "skipped"
                skipped += 1
            else:
                _import_single_movie(tmdb_id)
                status = "imported"
                imported += 1

            log_entries.append({"title": title, "status": status})
            log.info(f"[{source}] {status}: {title}")
            _job_events[job_id].append({
                "type": "progress", "current": i, "total": len(movies_to_import),
                "title": title, "status": status,
            })
        except Exception as e:
            failed += 1
            title = movie.get("title", "Unknown")
            log.error(f"[{source}] failed: {movie} — {e}")
            _job_events[job_id].append({
                "type": "progress", "current": i, "total": len(movies_to_import),
                "title": title, "status": "failed",
            })
            log_entries.append({"title": title, "status": "failed"})

    elapsed = round(time.time() - start, 1)
    db.finish_import_session(session_id, imported, skipped, failed, log_entries)
    _job_events[job_id].append({
        "type": "done",
        "imported": imported,
        "skipped": skipped,
        "failed": failed,
        "elapsed_seconds": elapsed,
    })
    _jobs[job_id]["done"] = True


def _resolve_folder_movies(parsed_movies: list[dict]) -> list[dict]:
    """Resolve parsed filenames to TMDB IDs via search."""
    resolved = []
    for m in parsed_movies:
        try:
            results = tmdb.search_movies(m["title"], page=1)
            items = results.get("results", [])
            if m.get("year"):
                match = next(
                    (r for r in items if str(r.get("release_date", ""))[:4] == str(m["year"])),
                    None,
                )
            else:
                match = items[0] if items else None
            if match:
                resolved.append({"tmdb_id": match["id"], "title": match["title"]})
        except Exception:
            pass
    return resolved


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


class PlexStartBody(BaseModel):
    plex_url: str
    plex_token: str
    section_key: str


class FolderStartBody(BaseModel):
    folder_path: str
    recursive: bool = True


class FolderPreviewBody(BaseModel):
    folder_path: str
    recursive: bool = True


# ---------------------------------------------------------------------------
# SSE progress endpoint
# ---------------------------------------------------------------------------

@router.get("/progress/{job_id}")
async def import_progress(job_id: str):
    """SSE stream of import progress events for a given job_id."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        sent = 0
        while True:
            events = _job_events.get(job_id, [])
            while sent < len(events):
                import json
                yield {"data": json.dumps(events[sent])}
                sent += 1
            if _jobs[job_id]["done"] and sent >= len(_job_events.get(job_id, [])):
                break
            await asyncio.sleep(0.2)

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# TMDB List endpoints
# ---------------------------------------------------------------------------

@router.get("/tmdb-list/{list_id}")
def preview_tmdb_list(list_id: str):
    """Preview a TMDB list — returns name, description, total and first 5 movies."""
    clean_id = _strip_tmdb_list_url(list_id)
    try:
        data = tmdb._get(f"/list/{clean_id}")
    except TMDBRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e), headers={"Retry-After": str(e.retry_after)})
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


@router.post("/tmdb-list/{list_id}/start")
def start_tmdb_list_import(list_id: str):
    """Start a streaming import from a TMDB list. Returns job_id."""
    clean_id = _strip_tmdb_list_url(list_id)
    try:
        data = tmdb._get(f"/list/{clean_id}")
    except TMDBRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e), headers={"Retry-After": str(e.retry_after)})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB error: {e}")

    items = data.get("items", [])
    movies = [
        {"tmdb_id": item.get("id"), "title": item.get("title", "")}
        for item in items
    ]
    list_name = data.get("name", "")

    job_id = _new_job("tmdb_list")
    t = threading.Thread(
        target=_run_import,
        args=(job_id, movies, "tmdb_list", f"list:{clean_id}"),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "total": len(movies), "list_name": list_name}


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


@router.post("/trakt/start")
def start_trakt_import(body: TraktImportBody):
    """Start a streaming import from Trakt. Returns job_id."""
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

    source_detail = f"{body.username}/{body.list_slug or 'watchlist'}"
    job_id = _new_job("trakt")
    t = threading.Thread(
        target=_run_import,
        args=(job_id, movies, "trakt", source_detail),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "total": len(movies)}


# ---------------------------------------------------------------------------
# Plex endpoints
# ---------------------------------------------------------------------------

@router.get("/plex/saved")
def get_plex_saved():
    """
    Return Plex libraries using PLEX_URL + PLEX_TOKEN from .env.
    Returns {configured: bool, plex_url: str, libraries: [...]}
    """
    import os
    plex_url   = os.getenv("PLEX_URL", "").strip()
    plex_token = os.getenv("PLEX_TOKEN", "").strip()

    placeholders = {"your_plex_token_here", ""}
    if not plex_url or not plex_token or plex_token in placeholders:
        return {"configured": False, "plex_url": "", "libraries": []}

    try:
        if not plex_client.validate_connection(plex_url, plex_token):
            return {"configured": True, "plex_url": plex_url, "libraries": [], "error": "Cannot reach Plex server"}
        libraries = plex_client.get_libraries(plex_url, plex_token)
        return {"configured": True, "plex_url": plex_url, "libraries": libraries}
    except Exception as e:
        return {"configured": True, "plex_url": plex_url, "libraries": [], "error": str(e)}


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


@router.post("/plex/start")
def start_plex_import(body: PlexStartBody):
    """Start a streaming import from a Plex library. Returns job_id."""
    try:
        movies = plex_client.get_library_movies(body.plex_url, body.plex_token, body.section_key)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Plex error: {e}")

    importable = [m for m in movies if m.get("tmdb_id")]
    unresolved = [m for m in movies if not m.get("tmdb_id")]

    # Pre-seed unresolved as failed events so the total is accurate
    all_movies: list[dict] = importable + [
        {"tmdb_id": None, "title": m.get("title", "Unknown")} for m in unresolved
    ]

    job_id = _new_job("plex")
    t = threading.Thread(
        target=_run_import,
        args=(job_id, all_movies, "plex", body.section_key),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "total": len(all_movies)}


# ---------------------------------------------------------------------------
# Folder endpoints
# ---------------------------------------------------------------------------

@router.post("/folder/preview")
def preview_folder(body: FolderPreviewBody):
    """Scan a local folder and return parsed movie list (no TMDB lookup)."""
    try:
        parsed = scanner.scan_folder(body.folder_path, body.recursive)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    preview = [
        {"title": m["title"], "year": m["year"], "filename": m["filename"]}
        for m in parsed[:10]
    ]
    return {"total": len(parsed), "movies": preview}


@router.post("/folder/start")
def start_folder_import(body: FolderStartBody):
    """Scan folder, resolve TMDB IDs, start streaming import. Returns job_id."""
    try:
        parsed = scanner.scan_folder(body.folder_path, body.recursive)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not parsed:
        raise HTTPException(status_code=400, detail="No movie files found in the specified folder.")

    # Resolve TMDB IDs synchronously (fast enough for a start endpoint)
    resolved = _resolve_folder_movies(parsed)

    if not resolved:
        raise HTTPException(status_code=400, detail="Could not match any files to TMDB movies.")

    job_id = _new_job("folder")
    t = threading.Thread(
        target=_run_import,
        args=(job_id, resolved, "folder", body.folder_path),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "total": len(resolved)}


# ---------------------------------------------------------------------------
# Import sessions
# ---------------------------------------------------------------------------

@router.get("/sessions")
def get_sessions():
    """Return recent import sessions (last 20)."""
    return db.get_import_sessions(limit=20)
