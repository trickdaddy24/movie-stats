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

def _require_tmdb_key():
    """Raise 400 immediately if the TMDB API key is not configured."""
    if not tmdb.TMDB_API_KEY or tmdb.TMDB_API_KEY == "your_tmdb_api_key_here":
        raise HTTPException(
            status_code=400,
            detail="TMDB API key not configured — add it in Settings",
        )


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
    _jobs[job_id] = {"done": False, "source": source, "cancelled": False}
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

    cancelled = False
    for i, movie in enumerate(movies_to_import, 1):
        if _jobs[job_id].get("cancelled"):
            cancelled = True
            break

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
                "title": title, "status": "failed", "reason": str(e),
            })
            log_entries.append({"title": title, "status": "failed"})

    elapsed = round(time.time() - start, 1)
    db.finish_import_session(session_id, imported, skipped, failed, log_entries)
    done_event: dict = {
        "type": "done",
        "imported": imported,
        "skipped": skipped,
        "failed": failed,
        "elapsed_seconds": elapsed,
    }
    if cancelled:
        done_event["reason"] = "Import cancelled by user"
    _job_events[job_id].append(done_event)
    _jobs[job_id]["done"] = True


def _resolve_folder_movies(parsed_movies: list[dict]) -> tuple[list[dict], list[dict], str | None]:
    """
    Resolve parsed filenames to TMDB IDs via search.
    Returns (resolved, unresolved, last_api_error).
    last_api_error is set to the exception message if any search raised an error,
    so callers can surface the real reason when nothing resolved.
    """
    resolved = []
    unresolved = []
    last_api_error: str | None = None
    for m in parsed_movies:
        matched = False
        for attempt in range(2):
            try:
                results = tmdb.search_movies(m["title"], page=1)
                items = results.get("results", [])
                if m.get("year"):
                    # Prefer exact year match, fall back to top result
                    hit = next(
                        (r for r in items if str(r.get("release_date", ""))[:4] == str(m["year"])),
                        items[0] if items else None,
                    )
                else:
                    hit = items[0] if items else None
                if hit:
                    resolved.append({"tmdb_id": hit["id"], "title": hit["title"]})
                    matched = True
                else:
                    log.warning(f"[folder] No TMDB result for '{m['title']}' ({m.get('year', '?')})")
                break
            except TMDBRateLimitError as e:
                log.warning(f"[folder] Rate limited searching '{m['title']}', sleeping {e.retry_after}s")
                time.sleep(e.retry_after)
            except Exception as e:
                last_api_error = str(e)
                log.warning(f"[folder] Search error for '{m['title']}': {e}")
                break
        if not matched:
            unresolved.append(m)
        time.sleep(0.25)
    return resolved, unresolved, last_api_error


def _run_plex_import(job_id: str, plex_url: str, plex_token: str, section_key: str) -> None:
    """Fetch Plex library in the background thread, then run the standard import loop."""
    try:
        movies = plex_client.get_library_movies(plex_url, plex_token, section_key)
    except Exception as e:
        log.error(f"[plex] Failed to fetch library: {e}")
        _job_events[job_id].append({"type": "start", "total": 0, "source": "plex"})
        _job_events[job_id].append({
            "type": "done", "imported": 0, "skipped": 0, "failed": 0,
            "elapsed_seconds": 0, "reason": f"Plex error: {e}",
        })
        _jobs[job_id]["done"] = True
        return

    importable = [m for m in movies if m.get("tmdb_id")]
    unresolved = [m for m in movies if not m.get("tmdb_id")]
    all_movies: list[dict] = importable + [
        {"tmdb_id": None, "title": m.get("title", "Unknown")} for m in unresolved
    ]
    _run_import(job_id, all_movies, "plex", section_key)


def _run_folder_import(job_id: str, parsed: list[dict], folder_path: str) -> None:
    """Resolve filenames to TMDB IDs in the background, then run the standard import loop."""
    resolved, unresolved, api_error = _resolve_folder_movies(parsed)

    if not resolved:
        sample = ", ".join(f'"{m["title"]}"' for m in parsed[:4])
        extra = f" ...+{len(parsed) - 4} more" if len(parsed) > 4 else ""
        log.warning(f"[folder] No TMDB matches for {len(parsed)} files in {folder_path}")
        if api_error:
            reason = f"TMDB search failed: {api_error}. Check your API key in Settings."
        else:
            reason = (
                f"No TMDB results for {len(parsed)} file(s). "
                f"Parsed as: {sample}{extra}. "
                f"Check your TMDB API key in Settings or rename files to include the movie title."
            )
        _job_events[job_id].append({"type": "start", "total": len(parsed), "source": "folder"})
        _job_events[job_id].append({
            "type": "done",
            "imported": 0,
            "skipped": 0,
            "failed": len(parsed),
            "elapsed_seconds": 0,
            "reason": reason,
        })
        _jobs[job_id]["done"] = True
        return

    # Unresolved files become per-item failures in the progress log
    all_movies = resolved + [
        {"tmdb_id": None, "title": f"{m['title']} ({m['year']})" if m.get("year") else m["title"]}
        for m in unresolved
    ]
    _run_import(job_id, all_movies, "folder", folder_path)


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
    _require_tmdb_key()
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
    _require_tmdb_key()
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
    import os
    plex_token = body.plex_token or os.getenv("PLEX_TOKEN", "").strip()
    if not plex_token:
        raise HTTPException(status_code=400, detail="Plex token not configured — add it in Settings")
    try:
        movies = plex_client.get_library_movies(body.plex_url, plex_token, body.section_key)
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
    """Start a streaming import from a Plex library. Returns job_id immediately."""
    import os
    _require_tmdb_key()
    plex_token = body.plex_token or os.getenv("PLEX_TOKEN", "").strip()
    if not plex_token:
        raise HTTPException(status_code=400, detail="Plex token not configured — add it in Settings")

    job_id = _new_job("plex")
    t = threading.Thread(
        target=_run_plex_import,
        args=(job_id, body.plex_url, plex_token, body.section_key),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# Cancel endpoint
# ---------------------------------------------------------------------------

@router.post("/cancel/{job_id}")
def cancel_import(job_id: str):
    """Signal a running import job to stop after the current movie."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    _jobs[job_id]["cancelled"] = True
    return {"ok": True}


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
    """Scan folder, start streaming import. TMDB resolution happens in the background thread."""
    _require_tmdb_key()
    try:
        parsed = scanner.scan_folder(body.folder_path, body.recursive)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not parsed:
        raise HTTPException(status_code=400, detail="No movie files found in the specified folder.")

    job_id = _new_job("folder")
    t = threading.Thread(
        target=_run_folder_import,
        args=(job_id, parsed, body.folder_path),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "total": len(parsed)}


# ---------------------------------------------------------------------------
# Import sessions
# ---------------------------------------------------------------------------

@router.get("/sessions")
def get_sessions():
    """Return recent import sessions (last 20)."""
    return db.get_import_sessions(limit=20)
