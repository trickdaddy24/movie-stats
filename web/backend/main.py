import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

import database as db_module
from routers import search, movies, artwork
from routers.imports import router as imports_router
from routers.settings import router as settings_router
from routers.test_match import router as test_router

app = FastAPI(title="Movie Stats API", version="1.4.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api")
app.include_router(movies.router, prefix="/api")
app.include_router(artwork.router, prefix="/api")
app.include_router(imports_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(test_router, prefix="/api")


@app.on_event("startup")
def startup():
    db_module.setup_db()
    tmdb_key = os.getenv("TMDB_API_KEY", "")
    fanart_key = os.getenv("FANART_API_KEY", "")
    trakt_key = os.getenv("TRAKT_CLIENT_ID", "")
    print("=" * 50)
    print("  Movie Stats API starting on port 8899")
    print(f"  TMDB API key set:    {'YES' if tmdb_key and tmdb_key != 'your_tmdb_api_key_here' else 'NO - set in .env'}")
    print(f"  fanart.tv key set:   {'YES' if fanart_key and fanart_key != 'your_fanart_api_key_here' else 'NO - set in .env'}")
    print(f"  Trakt client ID set: {'YES' if trakt_key and trakt_key != 'your_trakt_client_id_here' else 'NO - set in .env'}")
    print("=" * 50)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.4.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8899, reload=True)
