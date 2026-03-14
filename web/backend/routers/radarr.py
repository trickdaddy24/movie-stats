"""
routers/radarr.py — Radarr webhook receiver and sync events API
"""

import json
import logging
from fastapi import APIRouter, Request, Depends

import database as db
from auth_utils import get_current_user

log = logging.getLogger("radarr")

router = APIRouter(prefix="/radarr", tags=["radarr"])


# ---------------------------------------------------------------------------
# Public webhook endpoint (NO JWT required)
# ---------------------------------------------------------------------------

@router.post("/webhook")
async def radarr_webhook(request: Request):
    """
    Public webhook endpoint for Radarr to POST events.
    Always returns 200 so Radarr doesn't retry on failures.
    No authentication — Radarr cannot send auth headers by default.
    """
    try:
        body = await request.json()
    except Exception as e:
        log.warning(f"[radarr webhook] Invalid JSON: {e}")
        return {"ok": True}

    try:
        event_type = body.get("eventType", "unknown")
        movie = body.get("movie", {})
        tmdb_id = movie.get("tmdbId")
        radarr_id = movie.get("id")
        title = movie.get("title", "Unknown")
        raw_payload = json.dumps(body)

        # Insert the event
        db.add_radarr_sync_event(
            event_type=event_type,
            tmdb_id=tmdb_id,
            radarr_id=radarr_id,
            title=title,
            is_upgrade=bool(body.get("isUpgrade", False)),
            raw_payload=raw_payload,
        )

        # Update movie status if it exists in our library
        if event_type == "MovieAdded":
            if tmdb_id:
                db.update_movie_radarr_status(tmdb_id, radarr_id, "monitored")
            log.info(f"[radarr webhook] MovieAdded: {title} (Radarr ID: {radarr_id})")

        elif event_type == "Download":
            is_upgrade = body.get("isUpgrade", False)
            if tmdb_id:
                db.update_movie_radarr_status(tmdb_id, radarr_id, "downloaded")
            action = "upgraded" if is_upgrade else "downloaded"
            log.info(f"[radarr webhook] Download ({action}): {title}")

        elif event_type == "MovieDelete":
            if tmdb_id:
                db.update_movie_radarr_status(tmdb_id, radarr_id, "deleted")
            log.info(f"[radarr webhook] MovieDelete: {title}")

        elif event_type == "Grab":
            log.info(f"[radarr webhook] Grab: {title}")

        elif event_type == "Rename":
            log.info(f"[radarr webhook] Rename: {title}")

        elif event_type == "Test":
            log.info(f"[radarr webhook] Test webhook received")

        else:
            log.debug(f"[radarr webhook] Unknown event type: {event_type}")

    except Exception as e:
        log.error(f"[radarr webhook] Error processing event: {e}", exc_info=True)

    # Always return 200 so Radarr doesn't retry
    return {"ok": True}


# ---------------------------------------------------------------------------
# Sync events API endpoint (authenticated)
# ---------------------------------------------------------------------------

@router.get("/sync-events")
def get_sync_events(
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    """
    Return the last N radarr_sync_events rows for the Dashboard activity feed.
    Requires JWT authentication.
    """
    return db.get_radarr_sync_events(limit=limit)
