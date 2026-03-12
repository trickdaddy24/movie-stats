from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import database as db

router = APIRouter()


class ExternalIdBody(BaseModel):
    source: str
    external_id: str


@router.get("/movies")
def list_movies(
    search: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    genres: list[str] = Query([]),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("added_at"),
    sort_dir: str = Query("desc"),
):
    return db.list_movies(search=search, genre=genre, genres=genres if genres else None, page=page, page_size=page_size, sort_by=sort_by, sort_dir=sort_dir)


@router.get("/movies/{movie_id}")
def get_movie(movie_id: int):
    movie = db.get_movie_full(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


@router.delete("/movies/{movie_id}")
def delete_movie(movie_id: int):
    existing = db.get_movie_by_id(movie_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Movie not found")
    db.delete_movie(movie_id)
    return {"success": True, "deleted_id": movie_id}


@router.post("/movies/{movie_id}/external-id")
def add_external_id(movie_id: int, body: ExternalIdBody):
    existing = db.get_movie_by_id(movie_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Movie not found")
    db.add_external_id(movie_id, body.source, body.external_id)
    return {"success": True, "movie_id": movie_id, "source": body.source, "external_id": body.external_id}
