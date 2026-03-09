import os
import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.trakt.tv"


def get_client_id() -> str | None:
    val = os.getenv("TRAKT_CLIENT_ID", "")
    if not val or val == "your_trakt_client_id_here":
        return None
    return val


def _headers() -> dict:
    client_id = get_client_id() or ""
    return {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": client_id,
    }


def _parse_movie_item(item: dict) -> dict | None:
    """Parse a Trakt movie list item into {tmdb_id, title, year}. Returns None if no tmdb id."""
    movie = item.get("movie", {})
    ids = movie.get("ids", {})
    tmdb_id = ids.get("tmdb")
    if not tmdb_id:
        return None
    return {
        "tmdb_id": tmdb_id,
        "title": movie.get("title", ""),
        "year": movie.get("year"),
    }


def get_user_list(username: str, list_slug: str) -> list[dict]:
    """
    GET /users/{username}/lists/{list_slug}/items/movies
    Returns list of {tmdb_id, title, year}, skipping items without a TMDB ID.
    """
    url = f"{BASE_URL}/users/{username}/lists/{list_slug}/items/movies"
    with httpx.Client(timeout=20) as client:
        resp = client.get(url, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data:
        parsed = _parse_movie_item(item)
        if parsed:
            results.append(parsed)
    return results


def get_watchlist(username: str) -> list[dict]:
    """
    GET /users/{username}/watchlist/movies
    Returns list of {tmdb_id, title, year}, skipping items without a TMDB ID.
    """
    url = f"{BASE_URL}/users/{username}/watchlist/movies"
    with httpx.Client(timeout=20) as client:
        resp = client.get(url, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data:
        parsed = _parse_movie_item(item)
        if parsed:
            results.append(parsed)
    return results
