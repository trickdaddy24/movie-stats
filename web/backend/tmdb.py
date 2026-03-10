import logging
import os
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE_URL = "https://image.tmdb.org/t/p/"


class TMDBRateLimitError(Exception):
    def __init__(self, retry_after: int = 10):
        self.retry_after = retry_after
        super().__init__(f"TMDB rate limit hit — retry after {retry_after}s")

SIZE_POSTER = "w500"
SIZE_BACKDROP = "w1280"
SIZE_PROFILE = "w185"


def image_url(path: str, size: str = "w500") -> str:
    if not path:
        return ""
    if path.startswith("http"):
        return path
    return f"{IMAGE_BASE_URL}{size}{path}"


def _get(endpoint: str, params: dict = None) -> dict:
    if params is None:
        params = {}
    params["api_key"] = TMDB_API_KEY
    with httpx.Client(timeout=15) as client:
        resp = client.get(f"{BASE_URL}{endpoint}", params=params)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 10))
            logger.warning("TMDB rate limit hit on %s — retry after %ds", endpoint, retry_after)
            raise TMDBRateLimitError(retry_after)
        resp.raise_for_status()
        return resp.json()


def search_movies(query: str, page: int = 1) -> dict:
    data = _get("/search/movie", {"query": query, "page": page, "include_adult": False})
    results = []
    for m in data.get("results", []):
        results.append({
            "tmdb_id": m.get("id"),
            "title": m.get("title", ""),
            "original_title": m.get("original_title"),
            "overview": m.get("overview"),
            "release_date": m.get("release_date"),
            "rating": m.get("vote_average"),
            "vote_count": m.get("vote_count"),
            "poster_url": image_url(m.get("poster_path", ""), SIZE_POSTER),
            "backdrop_url": image_url(m.get("backdrop_path", ""), SIZE_BACKDROP),
            "genre_ids": m.get("genre_ids", []),
        })
    return {
        "results": results,
        "page": data.get("page", 1),
        "total_pages": data.get("total_pages", 1),
        "total_results": data.get("total_results", 0),
    }


def get_movie(tmdb_id: int) -> dict:
    data = _get(
        f"/movie/{tmdb_id}",
        {"append_to_response": "credits,external_ids,images", "include_image_language": "en,null"},
    )

    credits = data.get("credits", {})
    cast_raw = credits.get("cast", [])
    crew_raw = credits.get("crew", [])

    cast = []
    for i, person in enumerate(cast_raw[:20]):
        cast.append({
            "tmdb_person_id": person.get("id"),
            "name": person.get("name"),
            "role": "cast",
            "character_name": person.get("character"),
            "job": None,
            "department": "Acting",
            "display_order": i,
            "profile_path": image_url(person.get("profile_path", ""), SIZE_PROFILE),
        })

    crew = []
    seen_crew = set()
    for person in crew_raw:
        job = person.get("job", "")
        dept = person.get("department", "")
        if job in ("Director", "Screenplay", "Writer", "Story") or dept == "Directing":
            key = (person.get("id"), job)
            if key not in seen_crew:
                seen_crew.add(key)
                crew.append({
                    "tmdb_person_id": person.get("id"),
                    "name": person.get("name"),
                    "role": "crew",
                    "character_name": None,
                    "job": job,
                    "department": dept,
                    "display_order": len(crew),
                    "profile_path": image_url(person.get("profile_path", ""), SIZE_PROFILE),
                })

    images = data.get("images", {})
    posters = []
    for img in images.get("posters", [])[:5]:
        posters.append({
            "source": "tmdb",
            "type": "poster",
            "url": image_url(img.get("file_path", ""), SIZE_POSTER),
            "language": img.get("iso_639_1"),
            "likes": 0,
        })

    backdrops = []
    for img in images.get("backdrops", [])[:5]:
        backdrops.append({
            "source": "tmdb",
            "type": "backdrop",
            "url": image_url(img.get("file_path", ""), SIZE_BACKDROP),
            "language": img.get("iso_639_1"),
            "likes": 0,
        })

    ext_ids = data.get("external_ids", {})
    genres = [g.get("name") for g in data.get("genres", []) if g.get("name")]

    poster_path = data.get("poster_path", "")
    backdrop_path = data.get("backdrop_path", "")

    if poster_path and not any(p["url"] == image_url(poster_path, SIZE_POSTER) for p in posters):
        posters.insert(0, {
            "source": "tmdb",
            "type": "poster",
            "url": image_url(poster_path, SIZE_POSTER),
            "language": None,
            "likes": 0,
        })

    if backdrop_path and not any(b["url"] == image_url(backdrop_path, SIZE_BACKDROP) for b in backdrops):
        backdrops.insert(0, {
            "source": "tmdb",
            "type": "backdrop",
            "url": image_url(backdrop_path, SIZE_BACKDROP),
            "language": None,
            "likes": 0,
        })

    return {
        "tmdb_id": data.get("id"),
        "imdb_id": ext_ids.get("imdb_id"),
        "title": data.get("title", ""),
        "original_title": data.get("original_title"),
        "overview": data.get("overview"),
        "release_date": data.get("release_date"),
        "runtime": data.get("runtime"),
        "rating": data.get("vote_average"),
        "vote_count": data.get("vote_count"),
        "tagline": data.get("tagline"),
        "genres": genres,
        "cast": cast,
        "crew": crew,
        "artwork": posters + backdrops,
        "poster_url": image_url(poster_path, SIZE_POSTER),
        "backdrop_url": image_url(backdrop_path, SIZE_BACKDROP),
        "external_ids": ext_ids,
    }


def get_by_imdb_id(imdb_id: str) -> Optional[dict]:
    try:
        data = _get(f"/find/{imdb_id}", {"external_source": "imdb_id"})
        results = data.get("movie_results", [])
        if results:
            m = results[0]
            return {
                "tmdb_id": m.get("id"),
                "title": m.get("title", ""),
                "original_title": m.get("original_title"),
                "overview": m.get("overview"),
                "release_date": m.get("release_date"),
                "rating": m.get("vote_average"),
                "poster_url": image_url(m.get("poster_path", ""), SIZE_POSTER),
                "backdrop_url": image_url(m.get("backdrop_path", ""), SIZE_BACKDROP),
            }
    except Exception:
        pass
    return None
