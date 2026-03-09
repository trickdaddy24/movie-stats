"""
routers/test_match.py — TMDB match testing (dry run + live fetch preview)
Nothing in this router writes to the database.
"""

import difflib
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

import tmdb
import fanart

router = APIRouter(prefix="/test", tags=["test"])


def _match_score(candidate_title: str, candidate_year: Optional[int],
                 query_title: str, query_year: Optional[int]) -> int:
    """
    Return a 0-100 confidence score for how well a TMDB candidate matches
    the user's query.
    """
    title_ratio = difflib.SequenceMatcher(
        None,
        query_title.lower().strip(),
        candidate_title.lower().strip(),
    ).ratio()

    score = int(title_ratio * 70)  # title accounts for up to 70 pts

    if query_year and candidate_year:
        if query_year == candidate_year:
            score += 30          # exact year match
        elif abs(query_year - candidate_year) == 1:
            score += 10          # off by one (common with release date ambiguity)
    elif not query_year:
        score += 15              # no year provided — give partial year credit

    return min(score, 100)


def _confidence_label(score: int) -> str:
    if score >= 90: return "excellent"
    if score >= 70: return "good"
    if score >= 50: return "fair"
    return "low"


@router.get("/match")
def dry_run_match(
    title: str = Query(..., description="Movie title to search"),
    year: Optional[int] = Query(None, description="Release year (optional)"),
):
    """
    Dry-run TMDB search. Returns top candidates with match confidence scores.
    Nothing is saved to the database.
    """
    try:
        results = tmdb.search_movies(title, page=1)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB search failed: {e}")

    candidates = []
    for item in results.get("results", [])[:10]:
        candidate_title = item.get("title", "")
        release_date    = item.get("release_date", "")
        candidate_year  = int(release_date[:4]) if release_date and len(release_date) >= 4 else None
        tmdb_id         = item.get("id")
        score           = _match_score(candidate_title, candidate_year, title, year)

        candidates.append({
            "tmdb_id":     tmdb_id,
            "title":       candidate_title,
            "year":        candidate_year,
            "overview":    (item.get("overview") or "")[:200],
            "rating":      item.get("vote_average"),
            "vote_count":  item.get("vote_count"),
            "poster_url":  tmdb.image_url(item.get("poster_path") or "", tmdb.SIZE_POSTER),
            "score":       score,
            "confidence":  _confidence_label(score),
        })

    # Sort by score desc
    candidates.sort(key=lambda x: x["score"], reverse=True)

    return {
        "query_title": title,
        "query_year":  year,
        "total_found": results.get("total_results", 0),
        "candidates":  candidates,
    }


@router.get("/fetch/{tmdb_id}")
def live_fetch_preview(tmdb_id: int):
    """
    Live fetch of full TMDB details + fanart.tv artwork for a given TMDB ID.
    Shows exactly what would be saved on import — nothing is written to the DB.
    """
    try:
        movie = tmdb.get_movie(tmdb_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB fetch failed: {e}")

    try:
        art = fanart.get_movie_art_flat(tmdb_id)
    except Exception:
        art = []

    # Summarise artwork by type
    art_summary: dict[str, int] = {}
    for a in art:
        t = a.get("type", "unknown")
        art_summary[t] = art_summary.get(t, 0) + 1

    cast  = movie.get("cast", [])
    crew  = movie.get("crew", [])
    tmdb_art = movie.get("artwork", [])

    return {
        "tmdb_id":        movie.get("tmdb_id"),
        "imdb_id":        movie.get("imdb_id"),
        "title":          movie.get("title"),
        "original_title": movie.get("original_title"),
        "tagline":        movie.get("tagline"),
        "overview":       movie.get("overview"),
        "release_date":   movie.get("release_date"),
        "runtime":        movie.get("runtime"),
        "rating":         movie.get("rating"),
        "vote_count":     movie.get("vote_count"),
        "genres":         movie.get("genres", []),
        "poster_url":     next((a["url"] for a in tmdb_art if a.get("type") == "poster"), None),
        "backdrop_url":   next((a["url"] for a in tmdb_art if a.get("type") == "backdrop"), None),
        "cast_count":     len(cast),
        "crew_count":     len(crew),
        "cast_preview":   [{"name": p.get("name"), "character": p.get("character_name")} for p in cast[:5]],
        "crew_preview":   [{"name": p.get("name"), "job": p.get("job")} for p in crew[:5]],
        "artwork_summary": art_summary,
        "artwork_total":  len(tmdb_art) + len(art),
        "external_ids":   movie.get("external_ids", {}),
        "would_save": {
            "movies_row":    True,
            "cast_crew_rows": len(cast) + len(crew),
            "genre_rows":    len(movie.get("genres", [])),
            "artwork_rows":  len(tmdb_art) + len(art),
            "external_id_rows": sum(1 for v in [
                movie.get("imdb_id"),
                movie.get("external_ids", {}).get("wikidata_id"),
                movie.get("external_ids", {}).get("facebook_id"),
                movie.get("external_ids", {}).get("instagram_id"),
                movie.get("external_ids", {}).get("twitter_id"),
            ] if v),
        },
    }
