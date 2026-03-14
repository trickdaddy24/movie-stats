import logging
import httpx

logger = logging.getLogger(__name__)


def validate_connection(radarr_url: str, api_key: str) -> bool:
    """
    Validate connection to Radarr by calling GET /api/v3/system/status
    Returns True if appName == 'Radarr' and status < 400
    """
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{radarr_url}/api/v3/system/status",
                headers={"X-Api-Key": api_key},
            )
            if resp.status_code >= 400:
                return False
            data = resp.json()
            return data.get("appName") == "Radarr"
    except Exception as e:
        logger.error(f"[radarr] Connection validation failed: {e}")
        return False


def get_all_movies(radarr_url: str, api_key: str) -> list[dict]:
    """
    Fetch all movies from Radarr via GET /api/v3/movie
    Returns list of dicts with keys: tmdb_id, radarr_id, title, year, root_folder_path,
                                      monitored, has_file, radarr_status
    """
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{radarr_url}/api/v3/movie",
                headers={"X-Api-Key": api_key},
            )
            resp.raise_for_status()
            movies_data = resp.json()
            if not isinstance(movies_data, list):
                movies_data = []

            results = []
            for item in movies_data:
                radarr_status = _derive_status(item)
                results.append({
                    "tmdb_id": item.get("tmdbId"),
                    "radarr_id": item.get("id"),
                    "title": item.get("title", ""),
                    "year": item.get("year"),
                    "root_folder_path": item.get("rootFolderPath", ""),
                    "monitored": item.get("monitored", False),
                    "has_file": item.get("hasFile", False),
                    "radarr_status": radarr_status,
                })
            return results
    except Exception as e:
        logger.error(f"[radarr] Failed to fetch movies: {e}")
        raise


def _derive_status(item: dict) -> str:
    """Derive radarr_status from Radarr movie object."""
    if item.get("status") == "deleted":
        return "deleted"
    if item.get("hasFile"):
        return "downloaded"
    if item.get("monitored"):
        return "monitored"
    return "unmonitored"
