from fastapi import APIRouter, HTTPException, Depends
import tmdb
from tmdb import TMDBRateLimitError
import database as db
from auth_utils import get_current_user

router = APIRouter()


@router.get("/person/{tmdb_person_id}")
def get_person(
    tmdb_person_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get person details with full filmography, annotated with library status."""
    try:
        person = tmdb.get_person(tmdb_person_id)
    except TMDBRateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail=str(e),
            headers={"Retry-After": str(e.retry_after)},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB error: {e}")

    # Collect all tmdb_ids from both credit lists
    all_tmdb_ids = list({
        c["tmdb_id"] for c in person["cast_credits"] + person["crew_credits"]
        if c.get("tmdb_id")
    })

    library_map = db.get_library_ids_for_tmdb_ids(all_tmdb_ids)

    # Annotate each credit entry
    for credit in person["cast_credits"]:
        tid = credit.get("tmdb_id")
        credit["in_library"] = tid in library_map
        credit["library_id"] = library_map.get(tid)

    for credit in person["crew_credits"]:
        tid = credit.get("tmdb_id")
        credit["in_library"] = tid in library_map
        credit["library_id"] = library_map.get(tid)

    return person
