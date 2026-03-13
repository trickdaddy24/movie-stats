from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional
import database as db
from auth_utils import get_current_user

router = APIRouter(prefix="/lists", tags=["lists"])


# Request/Response models
class CreateListRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class AddMovieRequest(BaseModel):
    movie_id: int


class ListResponse(BaseModel):
    id: int
    user_id: int
    name: str
    list_type: str
    description: Optional[str]
    created_at: str
    movie_count: int


class MovieInListResponse(BaseModel):
    id: int
    tmdb_id: int
    title: str
    rating: Optional[float]
    release_date: Optional[str]
    runtime: Optional[int]
    poster_url: Optional[str]
    genres: list[str]


# Endpoints
@router.get("", response_model=list[ListResponse])
def get_lists(current_user: dict = Depends(get_current_user)):
    """Get all lists for the current user."""
    lists = db.get_user_lists(current_user["id"])
    return [ListResponse(**lst) for lst in lists]


@router.post("", response_model=ListResponse)
def create_list(
    request: CreateListRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new custom list."""
    with db.get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO user_lists (user_id, name, list_type, description)
            VALUES (?, ?, ?, ?)
            """,
            (current_user["id"], request.name, "custom", request.description),
        )
        list_id = cursor.lastrowid
        lst = conn.execute(
            """
            SELECT id, user_id, name, list_type, description, created_at, 0 as movie_count
            FROM user_lists WHERE id=?
            """,
            (list_id,),
        ).fetchone()

    return ListResponse(**dict(lst))


@router.get("/{list_id}", response_model=dict)
def get_list(
    list_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get a list and its movies."""
    with db.get_db() as conn:
        list_row = conn.execute(
            "SELECT * FROM user_lists WHERE id=? AND user_id=?",
            (list_id, current_user["id"]),
        ).fetchone()

        if not list_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="List not found",
            )

    movies = db.get_list_movies(list_id, current_user["id"])

    return {
        "list": ListResponse(**dict(list_row)),
        "movies": [
            MovieInListResponse(
                **{
                    k: v
                    for k, v in m.items()
                    if k
                    in [
                        "id",
                        "tmdb_id",
                        "title",
                        "rating",
                        "release_date",
                        "runtime",
                        "poster_url",
                        "genres",
                    ]
                }
            )
            for m in movies
        ],
    }


@router.delete("/{list_id}")
def delete_list(
    list_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a custom list (cannot delete favorites/watchlist)."""
    with db.get_db() as conn:
        list_row = conn.execute(
            "SELECT list_type FROM user_lists WHERE id=? AND user_id=?",
            (list_id, current_user["id"]),
        ).fetchone()

        if not list_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="List not found",
            )

        if list_row["list_type"] in ("favorites", "watchlist"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete built-in lists",
            )

        conn.execute("DELETE FROM user_lists WHERE id=?", (list_id,))

    return {"success": True}


@router.post("/{list_id}/movies")
def add_to_list(
    list_id: int,
    request: AddMovieRequest,
    current_user: dict = Depends(get_current_user),
):
    """Add a movie to a list."""
    success = db.add_movie_to_list(list_id, request.movie_id, current_user["id"])
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add movie to list (movie already in list or list not found)",
        )
    return {"success": True}


@router.delete("/{list_id}/movies/{movie_id}")
def remove_from_list(
    list_id: int,
    movie_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Remove a movie from a list."""
    success = db.remove_movie_from_list(list_id, movie_id, current_user["id"])
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List or movie not found",
        )
    return {"success": True}


@router.get("/movies/{movie_id}/lists")
def get_movie_lists(
    movie_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get which lists contain a movie."""
    list_ids = db.get_movie_list_membership(movie_id, current_user["id"])
    return {"list_ids": list_ids}
