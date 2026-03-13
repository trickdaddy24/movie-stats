import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

DB_PATH = "movie_stats.db"


def setup_db():
    with get_db() as conn:
        conn.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;

            CREATE TABLE IF NOT EXISTS movies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tmdb_id INTEGER UNIQUE NOT NULL,
                imdb_id TEXT,
                title TEXT NOT NULL,
                original_title TEXT,
                overview TEXT,
                release_date TEXT,
                runtime INTEGER,
                rating REAL,
                vote_count INTEGER,
                tagline TEXT,
                content_rating TEXT,
                source TEXT DEFAULT 'manual',
                plex_library TEXT,
                status TEXT DEFAULT 'active',
                added_at TEXT
            );

            CREATE TABLE IF NOT EXISTS external_ids (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
                source TEXT NOT NULL,
                external_id TEXT NOT NULL,
                UNIQUE(movie_id, source)
            );

            CREATE TABLE IF NOT EXISTS cast_crew (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
                tmdb_person_id INTEGER,
                name TEXT,
                role TEXT,
                character_name TEXT,
                job TEXT,
                department TEXT,
                display_order INTEGER,
                profile_path TEXT
            );

            CREATE TABLE IF NOT EXISTS genres (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
                name TEXT
            );

            CREATE TABLE IF NOT EXISTS artwork (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
                source TEXT,
                type TEXT,
                url TEXT,
                language TEXT,
                likes INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS import_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                source_detail TEXT,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                total INTEGER DEFAULT 0,
                imported INTEGER DEFAULT 0,
                skipped INTEGER DEFAULT 0,
                failed INTEGER DEFAULT 0,
                log_json TEXT DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS user_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                list_type TEXT NOT NULL DEFAULT 'custom',
                description TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, list_type)
            );

            CREATE TABLE IF NOT EXISTS user_list_movies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                list_id INTEGER NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
                movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
                added_at TEXT DEFAULT (datetime('now')),
                UNIQUE(list_id, movie_id)
            );
        """)

        # Migrations for existing databases
        try:
            conn.execute("ALTER TABLE movies ADD COLUMN content_rating TEXT")
        except Exception:
            pass  # column already exists
        try:
            conn.execute("ALTER TABLE movies ADD COLUMN source TEXT DEFAULT 'manual'")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE movies ADD COLUMN plex_library TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE movies ADD COLUMN user_id INTEGER REFERENCES users(id)")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE import_sessions ADD COLUMN user_id INTEGER REFERENCES users(id)")
        except Exception:
            pass


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def add_movie(movie_data: dict) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO movies
                (tmdb_id, imdb_id, title, original_title, overview,
                 release_date, runtime, rating, vote_count, tagline, content_rating,
                 source, plex_library, status, added_at)
            VALUES
                (:tmdb_id, :imdb_id, :title, :original_title, :overview,
                 :release_date, :runtime, :rating, :vote_count, :tagline, :content_rating,
                 :source, :plex_library, :status, :added_at)
            ON CONFLICT(tmdb_id) DO UPDATE SET
                imdb_id=excluded.imdb_id,
                title=excluded.title,
                original_title=excluded.original_title,
                overview=excluded.overview,
                release_date=excluded.release_date,
                runtime=excluded.runtime,
                rating=excluded.rating,
                vote_count=excluded.vote_count,
                tagline=excluded.tagline,
                content_rating=excluded.content_rating
            """,
            {
                "tmdb_id": movie_data.get("tmdb_id"),
                "imdb_id": movie_data.get("imdb_id"),
                "title": movie_data.get("title", ""),
                "original_title": movie_data.get("original_title"),
                "overview": movie_data.get("overview"),
                "release_date": movie_data.get("release_date"),
                "runtime": movie_data.get("runtime"),
                "rating": movie_data.get("rating"),
                "vote_count": movie_data.get("vote_count"),
                "tagline": movie_data.get("tagline"),
                "content_rating": movie_data.get("content_rating"),
                "source": movie_data.get("source", "manual"),
                "plex_library": movie_data.get("plex_library"),
                "status": movie_data.get("status", "active"),
                "added_at": movie_data.get("added_at", datetime.now(timezone.utc).isoformat()),
            },
        )
        if cursor.lastrowid:
            return cursor.lastrowid
        row = conn.execute(
            "SELECT id FROM movies WHERE tmdb_id=?", (movie_data["tmdb_id"],)
        ).fetchone()
        return row["id"]


def add_cast_crew(movie_id: int, people: list):
    with get_db() as conn:
        conn.execute("DELETE FROM cast_crew WHERE movie_id=?", (movie_id,))
        conn.executemany(
            """
            INSERT INTO cast_crew
                (movie_id, tmdb_person_id, name, role, character_name, job, department, display_order, profile_path)
            VALUES
                (:movie_id, :tmdb_person_id, :name, :role, :character_name, :job, :department, :display_order, :profile_path)
            """,
            [
                {
                    "movie_id": movie_id,
                    "tmdb_person_id": p.get("tmdb_person_id"),
                    "name": p.get("name"),
                    "role": p.get("role"),
                    "character_name": p.get("character_name"),
                    "job": p.get("job"),
                    "department": p.get("department"),
                    "display_order": p.get("display_order", 0),
                    "profile_path": p.get("profile_path"),
                }
                for p in people
            ],
        )


def add_genres(movie_id: int, genres: list):
    with get_db() as conn:
        conn.execute("DELETE FROM genres WHERE movie_id=?", (movie_id,))
        conn.executemany(
            "INSERT INTO genres (movie_id, name) VALUES (?, ?)",
            [(movie_id, g) for g in genres],
        )


def add_artwork(movie_id: int, artworks: list):
    with get_db() as conn:
        conn.execute("DELETE FROM artwork WHERE movie_id=?", (movie_id,))
        conn.executemany(
            """
            INSERT INTO artwork (movie_id, source, type, url, language, likes)
            VALUES (:movie_id, :source, :type, :url, :language, :likes)
            """,
            [
                {
                    "movie_id": movie_id,
                    "source": a.get("source", "tmdb"),
                    "type": a.get("type"),
                    "url": a.get("url"),
                    "language": a.get("language"),
                    "likes": a.get("likes", 0),
                }
                for a in artworks
            ],
        )


def add_external_id(movie_id: int, source: str, external_id: str):
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO external_ids (movie_id, source, external_id)
            VALUES (?, ?, ?)
            ON CONFLICT(movie_id, source) DO UPDATE SET external_id=excluded.external_id
            """,
            (movie_id, source, external_id),
        )


def get_movie_by_tmdb_id(tmdb_id: int) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM movies WHERE tmdb_id=?", (tmdb_id,)
        ).fetchone()
        return dict(row) if row else None


def get_movie_by_id(movie_id: int) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM movies WHERE id=?", (movie_id,)
        ).fetchone()
        return dict(row) if row else None


def get_movie_full(movie_id: int) -> dict:
    with get_db() as conn:
        movie_row = conn.execute(
            "SELECT * FROM movies WHERE id=?", (movie_id,)
        ).fetchone()
        if not movie_row:
            return {}

        movie = dict(movie_row)

        cast_rows = conn.execute(
            "SELECT * FROM cast_crew WHERE movie_id=? ORDER BY display_order",
            (movie_id,),
        ).fetchall()
        all_people = [dict(r) for r in cast_rows]
        movie["cast"] = [p for p in all_people if p["role"] == "cast"]
        movie["crew"] = [p for p in all_people if p["role"] == "crew"]

        genre_rows = conn.execute(
            "SELECT name FROM genres WHERE movie_id=?", (movie_id,)
        ).fetchall()
        movie["genres"] = [r["name"] for r in genre_rows]

        artwork_rows = conn.execute(
            "SELECT * FROM artwork WHERE movie_id=? ORDER BY likes DESC",
            (movie_id,),
        ).fetchall()
        movie["artwork"] = [dict(r) for r in artwork_rows]

        ext_rows = conn.execute(
            "SELECT source, external_id FROM external_ids WHERE movie_id=?",
            (movie_id,),
        ).fetchall()
        movie["external_ids"] = [dict(r) for r in ext_rows]

        return movie


def list_movies(search: Optional[str] = None, genre: Optional[str] = None, genres: Optional[list] = None, page: int = 1, page_size: int = 20, sort_by: str = "added_at", sort_dir: str = "desc") -> dict:
    with get_db() as conn:
        # Validate sort parameters
        SORT_COLS = {"title", "release_date", "rating", "runtime", "added_at"}
        if sort_by not in SORT_COLS:
            sort_by = "added_at"
        sort_dir = "ASC" if sort_dir.lower() == "asc" else "DESC"

        base_query = "FROM movies m"
        params: list = []
        where_clauses = []

        # Handle multi-genre or single genre
        if genres and isinstance(genres, list) and len(genres) > 0:
            base_query += " JOIN genres g ON g.movie_id = m.id"
            placeholders = ",".join("?" * len(genres))
            where_clauses.append(f"g.name IN ({placeholders})")
            params.extend(genres)
        elif genre:
            base_query += " JOIN genres g ON g.movie_id = m.id"
            where_clauses.append("g.name = ?")
            params.append(genre)

        if search:
            where_clauses.append("(m.title LIKE ? OR m.original_title LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])

        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)

        count_row = conn.execute(
            f"SELECT COUNT(DISTINCT m.id) {base_query}{where_sql}", params
        ).fetchone()
        total = count_row[0]

        offset = (page - 1) * page_size
        rows = conn.execute(
            f"SELECT DISTINCT m.* {base_query}{where_sql} ORDER BY m.{sort_by} {sort_dir} LIMIT ? OFFSET ?",
            params + [page_size, offset],
        ).fetchall()

        movies = []
        for row in rows:
            m = dict(row)
            genre_rows = conn.execute(
                "SELECT name FROM genres WHERE movie_id=?", (m["id"],)
            ).fetchall()
            m["genres"] = [r["name"] for r in genre_rows]
            artwork_row = conn.execute(
                "SELECT url FROM artwork WHERE movie_id=? AND type='poster' ORDER BY likes DESC LIMIT 1",
                (m["id"],),
            ).fetchone()
            m["poster_url"] = artwork_row["url"] if artwork_row else None
            movies.append(m)

        return {
            "movies": movies,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size),
        }


def delete_movie(movie_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM movies WHERE id=?", (movie_id,))


def search_local(query: str) -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM movies WHERE title LIKE ? OR original_title LIKE ? ORDER BY title LIMIT 50",
            (f"%{query}%", f"%{query}%"),
        ).fetchall()
        return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Import sessions
# ---------------------------------------------------------------------------

def create_import_session(source: str, source_detail: Optional[str] = None) -> int:
    """Insert a new import session row and return its id."""
    import json
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO import_sessions (source, source_detail, started_at, log_json)
            VALUES (?, ?, ?, '[]')
            """,
            (source, source_detail, datetime.now(timezone.utc).isoformat()),
        )
        return cursor.lastrowid


def finish_import_session(
    session_id: int,
    imported: int,
    skipped: int,
    failed: int,
    log_entries: list,
) -> None:
    """Update an import session with final counts and log."""
    import json
    with get_db() as conn:
        conn.execute(
            """
            UPDATE import_sessions
            SET finished_at=?, total=?, imported=?, skipped=?, failed=?, log_json=?
            WHERE id=?
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                imported + skipped + failed,
                imported,
                skipped,
                failed,
                json.dumps(log_entries),
                session_id,
            ),
        )


def get_import_sessions(limit: int = 20) -> list[dict]:
    """Return recent import sessions, newest first."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM import_sessions ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

def create_user(username: str, email: str, hashed_password: str) -> dict:
    """Create a new user and return user dict."""
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (username, email, hashed_password)
            VALUES (?, ?, ?)
            """,
            (username, email, hashed_password),
        )
        user_id = cursor.lastrowid
        # Create default Favorites and Watchlist lists
        create_default_lists(user_id)
        return get_user_by_id(user_id)


def get_user_by_username(username: str) -> Optional[dict]:
    """Get user by username."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, username, email, hashed_password, is_active, created_at FROM users WHERE username=?",
            (username,),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Get user by ID."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, username, email, is_active, created_at FROM users WHERE id=?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def create_default_lists(user_id: int) -> None:
    """Create default Favorites and Watchlist lists for a user."""
    with get_db() as conn:
        conn.executemany(
            """
            INSERT OR IGNORE INTO user_lists (user_id, name, list_type)
            VALUES (?, ?, ?)
            """,
            [
                (user_id, "Favorites", "favorites"),
                (user_id, "Watchlist", "watchlist"),
            ],
        )


def get_user_lists(user_id: int) -> list[dict]:
    """Get all lists for a user with movie counts."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT ul.id, ul.user_id, ul.name, ul.list_type, ul.description, ul.created_at,
                   COUNT(ulm.id) as movie_count
            FROM user_lists ul
            LEFT JOIN user_list_movies ulm ON ul.id = ulm.list_id
            WHERE ul.user_id = ?
            GROUP BY ul.id
            ORDER BY ul.list_type DESC, ul.name ASC
            """,
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_list_movies(list_id: int, user_id: int) -> list[dict]:
    """Get all movies in a list, with ownership verification."""
    with get_db() as conn:
        # Verify list ownership
        list_row = conn.execute(
            "SELECT user_id FROM user_lists WHERE id=?",
            (list_id,),
        ).fetchone()
        if not list_row or list_row["user_id"] != user_id:
            return []

        rows = conn.execute(
            """
            SELECT m.* FROM movies m
            JOIN user_list_movies ulm ON m.id = ulm.movie_id
            WHERE ulm.list_id = ?
            ORDER BY ulm.added_at DESC
            """,
            (list_id,),
        ).fetchall()

        movies = []
        for row in rows:
            m = dict(row)
            genre_rows = conn.execute(
                "SELECT name FROM genres WHERE movie_id=?", (m["id"],)
            ).fetchall()
            m["genres"] = [r["name"] for r in genre_rows]
            artwork_row = conn.execute(
                "SELECT url FROM artwork WHERE movie_id=? AND type='poster' ORDER BY likes DESC LIMIT 1",
                (m["id"],),
            ).fetchone()
            m["poster_url"] = artwork_row["url"] if artwork_row else None
            movies.append(m)
        return movies


def add_movie_to_list(list_id: int, movie_id: int, user_id: int) -> bool:
    """Add a movie to a list, with ownership verification."""
    with get_db() as conn:
        # Verify list ownership
        list_row = conn.execute(
            "SELECT user_id FROM user_lists WHERE id=?",
            (list_id,),
        ).fetchone()
        if not list_row or list_row["user_id"] != user_id:
            return False

        try:
            conn.execute(
                """
                INSERT INTO user_list_movies (list_id, movie_id)
                VALUES (?, ?)
                """,
                (list_id, movie_id),
            )
            return True
        except Exception:
            return False  # UNIQUE constraint violation or other error


def remove_movie_from_list(list_id: int, movie_id: int, user_id: int) -> bool:
    """Remove a movie from a list, with ownership verification."""
    with get_db() as conn:
        # Verify list ownership
        list_row = conn.execute(
            "SELECT user_id FROM user_lists WHERE id=?",
            (list_id,),
        ).fetchone()
        if not list_row or list_row["user_id"] != user_id:
            return False

        conn.execute(
            "DELETE FROM user_list_movies WHERE list_id=? AND movie_id=?",
            (list_id, movie_id),
        )
        return True


def get_movie_list_membership(movie_id: int, user_id: int) -> list[int]:
    """Get list IDs that contain a movie (for a given user)."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT ul.id FROM user_lists ul
            JOIN user_list_movies ulm ON ul.id = ulm.list_id
            WHERE ul.user_id = ? AND ulm.movie_id = ?
            """,
            (user_id, movie_id),
        ).fetchall()
        return [r["id"] for r in rows]
