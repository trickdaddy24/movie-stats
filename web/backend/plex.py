import httpx
import tmdb as tmdb_client


def _movie_headers(plex_token: str) -> dict:
    return {
        "X-Plex-Token": plex_token,
        "Accept": "application/json",
    }


def validate_connection(plex_url: str, plex_token: str) -> bool:
    """GET {plex_url}/ to check connectivity. Returns True if reachable."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                plex_url.rstrip("/") + "/",
                headers=_movie_headers(plex_token),
            )
            return resp.status_code < 400
    except Exception:
        return False


def get_libraries(plex_url: str, plex_token: str) -> list[dict]:
    """
    GET {plex_url}/library/sections
    Returns list of {key, title, type} filtered to type == "movie" only.
    """
    url = plex_url.rstrip("/") + "/library/sections"
    with httpx.Client(timeout=15) as client:
        resp = client.get(url, headers=_movie_headers(plex_token))
        resp.raise_for_status()
        data = resp.json()

    sections = data.get("MediaContainer", {}).get("Directory", [])
    return [
        {"key": s.get("key"), "title": s.get("title"), "type": s.get("type")}
        for s in sections
        if s.get("type") == "movie"
    ]


def _parse_tmdb_id_from_guids(guids: list) -> int | None:
    """Extract TMDB ID integer from a Plex Guid list."""
    for guid in guids:
        guid_id = guid.get("id", "")
        if guid_id.startswith("tmdb://"):
            raw = guid_id.replace("tmdb://", "").strip()
            try:
                return int(raw)
            except ValueError:
                pass
    return None


def _parse_imdb_id_from_guids(guids: list) -> str | None:
    """Extract IMDb ID string from a Plex Guid list."""
    for guid in guids:
        guid_id = guid.get("id", "")
        if guid_id.startswith("imdb://"):
            return guid_id.replace("imdb://", "").strip()
    return None


def get_library_movies(plex_url: str, plex_token: str, section_key: str) -> list[dict]:
    """
    GET {plex_url}/library/sections/{section_key}/all?type=1
    Returns list of {tmdb_id, imdb_id, title, year}.
    Falls back to TMDB title+year search if no tmdb:// GUID is present.
    """
    url = plex_url.rstrip("/") + f"/library/sections/{section_key}/all"
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            url,
            params={"type": 1},
            headers=_movie_headers(plex_token),
        )
        resp.raise_for_status()
        data = resp.json()

    metadata = data.get("MediaContainer", {}).get("Metadata", [])
    results = []

    for item in metadata:
        guids = item.get("Guid", [])
        title = item.get("title", "")
        year = item.get("year")

        tmdb_id = _parse_tmdb_id_from_guids(guids)
        imdb_id = _parse_imdb_id_from_guids(guids)

        # Fallback: search TMDB by title + year if no tmdb:// GUID present
        if not tmdb_id:
            try:
                search_result = tmdb_client.search_movies(title, page=1)
                for candidate in search_result.get("results", []):
                    cand_year = None
                    rd = candidate.get("release_date", "")
                    if rd and len(rd) >= 4:
                        try:
                            cand_year = int(rd[:4])
                        except ValueError:
                            pass
                    # prefer year-matched result, fall back to exact title match
                    if cand_year and year and cand_year == year:
                        tmdb_id = candidate.get("id")   # TMDB search returns "id" not "tmdb_id"
                        break
                    elif candidate.get("title", "").lower() == title.lower():
                        tmdb_id = candidate.get("id")
                        break
            except Exception:
                pass

        # Only include movies we successfully resolved to a TMDB ID
        if tmdb_id:
            results.append({
                "tmdb_id": tmdb_id,
                "imdb_id": imdb_id,
                "title": title,
                "year": year,
            })

    return results
