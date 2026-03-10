"""
movie.db.py — Movie Database CLI
Version: 1.3.0

Shares the same SQLite database as the web app (web/backend/movie_stats.db).
"""

import sys
import os
import json
import csv
import logging
import difflib
import re
from pathlib import Path
from contextlib import contextmanager
import sqlite3

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE      = Path(__file__).parent
DB_FILE    = _BASE / "web" / "backend" / "movie_stats.db"
LOG_FILE   = _BASE / "movie_db.log"
EXPORT_DIR = _BASE / "exports"
ENV_PATH   = _BASE / "web" / "backend" / ".env"

# Add web/backend to sys.path so we can import tmdb / fanart modules
sys.path.insert(0, str(_BASE / "web" / "backend"))

# ANSI colour helpers (auto-disable when not a TTY)
_USE_COLOR = hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()
if sys.platform == "win32" and _USE_COLOR:
    os.system("")          # enable VT100 on Windows terminal

def _c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text

def green(t): return _c(t, "92")
def red(t):   return _c(t, "91")
def dim(t):   return _c(t, "2")
def bold(t):  return _c(t, "1")
def blue(t):  return _c(t, "94")
def yellow(t):return _c(t, "93")

VERSION = "1.3.0"

API_KEYS = [
    {"key": "TMDB_API_KEY",    "label": "TMDB API Key",    "required": True,  "hint": "https://www.themoviedb.org/settings/api"},
    {"key": "FANART_API_KEY",  "label": "fanart.tv API Key","required": False, "hint": "https://fanart.tv/get-an-api-key/"},
    {"key": "TRAKT_CLIENT_ID", "label": "Trakt Client ID", "required": False, "hint": "https://trakt.tv/oauth/applications"},
    {"key": "PLEX_URL",        "label": "Plex Server URL",  "required": False, "hint": "e.g. http://192.168.1.100:32400"},
    {"key": "PLEX_TOKEN",      "label": "Plex Token",       "required": False, "hint": "https://support.plex.tv/articles/204059436/"},
]

logging.basicConfig(
    filename=str(LOG_FILE), level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)


# ── Database ──────────────────────────────────────────────────────────────────

@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_FILE))
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


def setup_db():
    """Create the shared web-app schema if it doesn't already exist."""
    with get_db() as conn:
        conn.executescript("""
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
        """)
    logging.info("DB ready")


def count_all() -> dict:
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
    return {"total": total}


# ── Library display ───────────────────────────────────────────────────────────

def list_entries(search: str = None):
    with get_db() as conn:
        if search:
            rows = conn.execute(
                "SELECT id, tmdb_id, title, release_date, rating, runtime, status "
                "FROM movies WHERE title LIKE ? OR original_title LIKE ? ORDER BY title LIMIT 100",
                (f"%{search}%", f"%{search}%")
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, tmdb_id, title, release_date, rating, runtime, status "
                "FROM movies ORDER BY added_at DESC LIMIT 100"
            ).fetchall()

    if not rows:
        print("  (no movies in library)")
        return

    print(f"\n  {'TMDB ID':<10} {'Title':<42} {'Year':<6} {'Rating':>6}  {'Runtime':<9}  Status")
    print("  " + "─" * 88)
    for r in rows:
        year    = r["release_date"][:4] if r["release_date"] else "—"
        runtime = f"{r['runtime']//60}h{r['runtime']%60:02d}m" if r["runtime"] else "—"
        rating  = f"{r['rating']:.1f}" if r["rating"] else "—"
        title   = r["title"][:41]
        print(f"  {r['tmdb_id']:<10} {title:<42} {year:<6} {rating:>6}  {runtime:<9}  {r['status']}")

    if len(rows) == 100:
        print(f"\n  {dim('Showing 100 most recent — use Search to narrow down.')}")


def view_entry(tmdb_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM movies WHERE tmdb_id=?", (tmdb_id,)).fetchone()
        if not row:
            print(f"  {red('✗')} No movie with TMDB ID {tmdb_id}.")
            return
        movie = dict(row)

        genres = [r[0] for r in conn.execute(
            "SELECT name FROM genres WHERE movie_id=?", (movie["id"],)
        ).fetchall()]

        cast = conn.execute(
            "SELECT name, character_name FROM cast_crew "
            "WHERE movie_id=? AND role='cast' ORDER BY display_order LIMIT 5",
            (movie["id"],)
        ).fetchall()

        crew = conn.execute(
            "SELECT name, job FROM cast_crew "
            "WHERE movie_id=? AND role='crew' ORDER BY display_order LIMIT 5",
            (movie["id"],)
        ).fetchall()

        art_counts = conn.execute(
            "SELECT type, COUNT(*) FROM artwork WHERE movie_id=? GROUP BY type",
            (movie["id"],)
        ).fetchall()

    print()
    print(f"  {bold(movie['title'])}")
    if movie.get("tagline"):
        print(f"  {dim(movie['tagline'])}")
    print()

    year    = movie["release_date"][:4] if movie.get("release_date") else "—"
    runtime = f"{movie['runtime']//60}h {movie['runtime']%60}m" if movie.get("runtime") else "—"
    rating  = f"{movie['rating']:.1f}" if movie.get("rating") else "—"

    fields = [
        ("TMDB ID",    str(movie["tmdb_id"])),
        ("IMDB ID",    movie.get("imdb_id") or "—"),
        ("Year",       year),
        ("Runtime",    runtime),
        ("Rating",     f"{rating}  ({movie.get('vote_count') or 0:,} votes)"),
        ("Genres",     ", ".join(genres) or "—"),
        ("Status",     movie.get("status", "active")),
        ("Added",      (movie.get("added_at") or "")[:10] or "—"),
    ]
    for label, val in fields:
        print(f"  {label:<14}: {val}")

    if movie.get("overview"):
        print(f"\n  Overview:\n  {movie['overview'][:320]}")

    if cast:
        print(f"\n  Cast (top 5):")
        for p in cast:
            print(f"    {p['name']:<26}  as  {p['character_name'] or '—'}")

    if crew:
        print(f"\n  Key Crew:")
        for p in crew:
            print(f"    {p['name']:<26}  {p['job'] or '—'}")

    if art_counts:
        art_str = "  ".join(f"{t}×{c}" for t, c in art_counts)
        print(f"\n  Artwork: {art_str}")


def delete_entry(tmdb_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, title FROM movies WHERE tmdb_id=?", (tmdb_id,)
        ).fetchone()
        if not row:
            print(f"  {red('✗')} No movie with TMDB ID {tmdb_id}.")
            return
        confirm = input(f"  Delete \"{row['title']}\" (TMDB {tmdb_id})? (yes/no): ").strip().lower()
        if confirm not in ("yes", "y"):
            print("  Cancelled.")
            return
        conn.execute("DELETE FROM movies WHERE id=?", (row["id"],))
    print(f"  {green('✓')} Deleted {row['title']}")
    logging.info(f"Deleted TMDB {tmdb_id} — {row['title']}")


def show_totals():
    with get_db() as conn:
        total     = conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
        art_total = conn.execute("SELECT COUNT(*) FROM artwork").fetchone()[0]
        cc_total  = conn.execute("SELECT COUNT(*) FROM cast_crew").fetchone()[0]
        statuses  = conn.execute(
            "SELECT status, COUNT(*) FROM movies GROUP BY status"
        ).fetchall()
        genres = conn.execute(
            "SELECT g.name, COUNT(*) as c FROM genres g "
            "GROUP BY g.name ORDER BY c DESC LIMIT 10"
        ).fetchall()
        recent = conn.execute(
            "SELECT title, release_date FROM movies ORDER BY added_at DESC LIMIT 5"
        ).fetchall()

    print(f"\n  Total movies   : {green(str(total))}")
    print(f"  Artwork rows   : {art_total}")
    print(f"  Cast/Crew rows : {cc_total}")

    if statuses:
        print(f"\n  By Status:")
        for s, c in statuses:
            print(f"    {s:<16}: {c}")

    if genres:
        print(f"\n  Top Genres:")
        for g, c in genres:
            print(f"    {g:<22}: {c}")

    if recent:
        print(f"\n  Recently Added:")
        for r in recent:
            year = r["release_date"][:4] if r["release_date"] else "—"
            print(f"    {r['title']}  ({year})")


# ── Export / Import ───────────────────────────────────────────────────────────

def export_json():
    EXPORT_DIR.mkdir(exist_ok=True)
    path = EXPORT_DIR / "movie_export.json"
    with get_db() as conn:
        rows = conn.execute(
            "SELECT tmdb_id, imdb_id, title, original_title, release_date, runtime, "
            "rating, vote_count, tagline, overview, status, added_at "
            "FROM movies ORDER BY title"
        ).fetchall()
    data = [dict(r) for r in rows]
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"  {green('✓')} Exported {len(data)} movies → {path}")
    logging.info(f"Exported {len(data)} to JSON")


def export_csv():
    EXPORT_DIR.mkdir(exist_ok=True)
    path = EXPORT_DIR / "movie_export.csv"
    fields = ["tmdb_id", "imdb_id", "title", "original_title", "release_date",
              "runtime", "rating", "vote_count", "tagline", "status", "added_at"]
    with get_db() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(fields)} FROM movies ORDER BY title"
        ).fetchall()
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows([dict(r) for r in rows])
    print(f"  {green('✓')} Exported {len(rows)} movies → {path}")
    logging.info(f"Exported {len(rows)} to CSV")


def import_json():
    path = EXPORT_DIR / "movie_export.json"
    if not path.exists():
        print(f"  {red('✗')} {path} not found")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    imported = skipped = 0
    with get_db() as conn:
        for m in data:
            if not m.get("tmdb_id") or not m.get("title"):
                skipped += 1
                continue
            try:
                conn.execute(
                    """INSERT INTO movies
                       (tmdb_id, imdb_id, title, original_title, release_date, runtime,
                        rating, vote_count, tagline, overview, status, added_at)
                       VALUES
                       (:tmdb_id, :imdb_id, :title, :original_title, :release_date, :runtime,
                        :rating, :vote_count, :tagline, :overview, :status, :added_at)
                       ON CONFLICT(tmdb_id) DO NOTHING""",
                    {k: m.get(k) for k in [
                        "tmdb_id", "imdb_id", "title", "original_title", "release_date",
                        "runtime", "rating", "vote_count", "tagline", "overview", "status", "added_at"
                    ]}
                )
                imported += 1
            except Exception as e:
                print(f"  ✗ Skipping TMDB {m.get('tmdb_id')}: {e}")
                skipped += 1
    print(f"  {green('✓')} Imported {imported}, skipped {skipped}")
    logging.info(f"JSON import: {imported} in, {skipped} skipped")


def import_csv():
    path = EXPORT_DIR / "movie_export.csv"
    if not path.exists():
        print(f"  {red('✗')} {path} not found")
        return
    imported = skipped = 0
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    with get_db() as conn:
        for m in rows:
            if not m.get("tmdb_id") or not m.get("title"):
                skipped += 1
                continue
            try:
                conn.execute(
                    """INSERT INTO movies
                       (tmdb_id, imdb_id, title, original_title, release_date, runtime,
                        rating, vote_count, tagline, status, added_at)
                       VALUES
                       (:tmdb_id, :imdb_id, :title, :original_title, :release_date, :runtime,
                        :rating, :vote_count, :tagline, :status, :added_at)
                       ON CONFLICT(tmdb_id) DO NOTHING""",
                    {k: m.get(k) or None for k in [
                        "tmdb_id", "imdb_id", "title", "original_title", "release_date",
                        "runtime", "rating", "vote_count", "tagline", "status", "added_at"
                    ]}
                )
                imported += 1
            except Exception as e:
                print(f"  ✗ Skipping TMDB {m.get('tmdb_id')}: {e}")
                skipped += 1
    print(f"  {green('✓')} Imported {imported}, skipped {skipped}")
    logging.info(f"CSV import: {imported} in, {skipped} skipped")


# ── Test Match ────────────────────────────────────────────────────────────────

def _match_score(candidate_title: str, candidate_year, query_title: str, query_year) -> int:
    ratio = difflib.SequenceMatcher(
        None, query_title.lower().strip(), candidate_title.lower().strip()
    ).ratio()
    score = int(ratio * 70)
    if query_year and candidate_year:
        if query_year == candidate_year:
            score += 30
        elif abs(query_year - candidate_year) == 1:
            score += 10
    elif not query_year:
        score += 15
    return min(score, 100)


def _confidence_label(score: int) -> str:
    if score >= 90: return "excellent"
    if score >= 70: return "good"
    if score >= 50: return "fair"
    return "low"


def _confidence_color(label: str):
    return {"excellent": green, "good": blue, "fair": yellow, "low": red}.get(label, dim)


def test_match_cli():
    # Load .env so the tmdb module picks up TMDB_API_KEY
    try:
        from dotenv import load_dotenv
        load_dotenv(ENV_PATH)
    except ImportError:
        pass

    try:
        import tmdb as tmdb_mod
    except ImportError:
        print(f"\n  {red('✗')} Could not import tmdb module from web/backend/.")
        print("  Make sure you are running this script from the MovieStats directory.")
        return

    print(f"\n  {bold('TMDB Match Test')}  —  dry run, nothing is saved\n")

    title = input("  Movie title: ").strip()
    if not title:
        print("  Cancelled.")
        return

    year_str = input("  Year (optional — press Enter to skip): ").strip()
    query_year = int(year_str) if year_str.isdigit() else None

    print(f"\n  Searching TMDB for \"{title}\"…\n")
    try:
        results = tmdb_mod.search_movies(title, page=1)
    except Exception as e:
        print(f"  {red('✗')} TMDB search failed: {e}")
        print("  Check that your TMDB API key is configured (Configure API Keys).")
        return

    raw_results = results.get("results", [])[:10]
    total       = results.get("total_results", 0)

    candidates = []
    for item in raw_results:
        ct  = item.get("title", "")
        rd  = item.get("release_date") or ""
        cy  = int(rd[:4]) if rd and len(rd) >= 4 else None
        score = _match_score(ct, cy, title, query_year)
        candidates.append({
            "tmdb_id":    item.get("tmdb_id"),
            "title":      ct,
            "year":       cy,
            "overview":   (item.get("overview") or "")[:120],
            "score":      score,
            "confidence": _confidence_label(score),
        })
    candidates.sort(key=lambda x: x["score"], reverse=True)

    print(f"  {total:,} results from TMDB — showing top {len(candidates)} with match scores\n")
    print(f"  {'#':<4} {'TMDB ID':<10} {'Score':<6}  {'Confidence':<11}  {'Title':<38}  Year")
    print("  " + "─" * 82)

    for i, c in enumerate(candidates, 1):
        cf       = c["confidence"]
        color    = _confidence_color(cf)
        score_s  = color(f"{c['score']}%")
        conf_s   = color(cf)
        title_s  = c["title"][:37]
        print(f"  {i:<4} {c['tmdb_id']:<10} {score_s:<6}  {conf_s:<11}  {title_s:<38}  {c['year'] or '—'}")

    if not candidates:
        print("  No results found.")
        return

    print()
    pick = input("  Enter # for a live full fetch (or Enter to skip): ").strip()
    if not pick.isdigit() or not (1 <= int(pick) <= len(candidates)):
        return

    selected = candidates[int(pick) - 1]
    print(f"\n  Fetching full details for TMDB {selected['tmdb_id']} — {selected['title']}…\n")

    try:
        movie = tmdb_mod.get_movie(selected["tmdb_id"])
    except Exception as e:
        print(f"  {red('✗')} TMDB fetch failed: {e}")
        return

    cast   = movie.get("cast", [])
    crew   = movie.get("crew", [])
    art    = movie.get("artwork", [])
    genres = movie.get("genres", [])
    ext    = movie.get("external_ids", {})

    fanart_count = 0
    try:
        import fanart as fanart_mod
        fanart_art   = fanart_mod.get_movie_art_flat(selected["tmdb_id"])
        fanart_count = len(fanart_art)
    except Exception:
        pass

    rd      = movie.get("release_date") or ""
    year    = rd[:4] if rd else "—"
    runtime = movie.get("runtime")
    rt_str  = f"{runtime//60}h {runtime%60}m" if runtime else "—"
    rating  = movie.get("rating")
    rt_disp = f"{rating:.1f}" if rating else "—"

    print(f"  {bold(movie.get('title', ''))}")
    if movie.get("tagline"):
        print(f"  {dim(movie['tagline'])}")
    print()
    print(f"  {'Year':<18}: {year}")
    print(f"  {'Runtime':<18}: {rt_str}")
    print(f"  {'Rating':<18}: {rt_disp}  ({movie.get('vote_count', 0):,} votes)")
    print(f"  {'Genres':<18}: {', '.join(genres) or '—'}")
    print(f"  {'TMDB ID':<18}: {movie.get('tmdb_id')}")
    print(f"  {'IMDB ID':<18}: {movie.get('imdb_id') or '—'}")
    for k, v in ext.items():
        if v:
            print(f"  {k:<18}: {v}")

    if movie.get("overview"):
        print(f"\n  Overview:\n  {movie['overview'][:320]}")

    print(f"\n  {bold('Would be saved to DB:')}")
    print(f"    Movies row      : 1")
    print(f"    Cast + Crew     : {len(cast) + len(crew)}")
    print(f"    Genres          : {len(genres)}")
    print(f"    Artwork (TMDB)  : {len(art)}")
    print(f"    Artwork (fanart): {fanart_count}")

    if cast[:5]:
        print(f"\n  Cast (top 5):")
        for p in cast[:5]:
            print(f"    {p.get('name', ''):<28}  as  {p.get('character_name') or '—'}")

    if crew[:5]:
        print(f"\n  Key Crew:")
        for p in crew[:5]:
            print(f"    {p.get('name', ''):<28}  {p.get('job') or '—'}")

    print(f"\n  {dim('Preview only — nothing was saved.')}")


# ── API Key Setup ─────────────────────────────────────────────────────────────

def read_env() -> dict:
    existing = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                existing[k.strip()] = v.strip()
    return existing


def write_env(values: dict):
    ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for cfg in API_KEYS:
        tag = " (required)" if cfg["required"] else " (optional)"
        lines.append(f"# {cfg['label']}{tag}")
        lines.append(f"{cfg['key']}={values.get(cfg['key'], '')}")
        lines.append("")
    ENV_PATH.write_text("\n".join(lines))


def setup_api_keys():
    print(f"\n  API Key Setup  —  saving to {ENV_PATH}")
    existing = read_env()
    if existing:
        print("  Existing values detected — press Enter to keep.\n")

    values = {}
    for cfg in API_KEYS:
        cur = existing.get(cfg["key"], "")
        tag = "[required]" if cfg["required"] else "[optional]"
        print(f"\n  {cfg['label']} {tag}")
        print(f"  {cfg['hint']}")
        if cur:
            masked = cur[:4] + "*" * max(0, len(cur) - 4)
            val = input(f"  Value [{masked}] (Enter to keep): ").strip()
            values[cfg["key"]] = val if val else cur
        else:
            prompt_text = "  Value: " if cfg["required"] else "  Value (Enter to skip): "
            while True:
                val = input(prompt_text).strip()
                if val or not cfg["required"]:
                    values[cfg["key"]] = val
                    break
                print("  ✗ Required.")

    print("\n  Summary:\n")
    for cfg in API_KEYS:
        val = values.get(cfg["key"], "")
        if val:
            display = green("✓  " + val[:4] + "*" * max(0, len(val) - 4))
        else:
            display = red("✗  not set")
        print(f"    {cfg['label']:<22}  {display}")

    confirm = input("\n  Save to .env? (yes/no): ").strip().lower()
    if confirm in ("yes", "y"):
        write_env(values)
        print(f"\n  {green('✓')} Saved to {ENV_PATH}")
        logging.info("API keys updated via CLI")
    else:
        print(f"  {red('✗')} Cancelled.")


def show_api_keys():
    existing = read_env()
    print(f"\n  API Key Status  —  {ENV_PATH}\n")
    for cfg in API_KEYS:
        val    = existing.get(cfg["key"], "")
        is_set = bool(val) and val not in (
            f"your_{cfg['key'].lower()}_here", "http://192.168.1.100:32400"
        )
        tag = dim("[required]") if cfg["required"] else dim("[optional]")
        if is_set:
            masked = val[:4] + "*" * max(0, len(val) - 4)
            status = green("✓  Enabled") + dim(f"  {masked}")
        else:
            status = red("✗  Not set")
        print(f"  {cfg['label']:<22} {tag:<22}  {status}")


# ── Data submenu ──────────────────────────────────────────────────────────────

def data_submenu():
    while True:
        print(f"\n  {bold('Data Import / Export')}")
        opts = ["Export JSON", "Import JSON", "Export CSV", "Import CSV", "Back"]
        for i, o in enumerate(opts, 1):
            print(f"  {i}. {o}")

        raw = input(f"\n  Choice (1-{len(opts)}): ").strip()
        if not raw.isdigit() or not (1 <= int(raw) <= len(opts)):
            print("  ✗ Invalid choice.")
            continue

        action = opts[int(raw) - 1]
        if   action == "Export JSON": export_json()
        elif action == "Import JSON": import_json()
        elif action == "Export CSV":  export_csv()
        elif action == "Import CSV":  import_csv()
        elif action == "Back":        return


# ── CLI ───────────────────────────────────────────────────────────────────────

def clean(s: str) -> str:
    return re.sub(r'[;\"\'\\]', '', s.strip()) if s else ""


def cli():
    counts = count_all()
    print(f"\n=== Movie Database  v{VERSION} ===")
    db_exists = DB_FILE.exists()
    db_label  = str(DB_FILE) if db_exists else red(str(DB_FILE) + " (not found)")
    print(f"  DB: {db_label}")
    print(f"  Library: {green(str(counts['total']))} movies")

    while True:
        has  = counts["total"] > 0
        opts = ["Totals & Stats"]
        if has:
            opts += ["List Library", "View Movie", "Delete Movie", "Search Library"]
        opts += ["Test Match (TMDB Dry Run)", "Data Import / Export"]
        opts += ["─── Settings ───", "Configure API Keys", "Show API Keys", "Exit"]

        print()
        for i, o in enumerate(opts, 1):
            if o.startswith("───"):
                print(f"\n  {o}")
            else:
                print(f"  {i}. {o}")

        raw = clean(input(f"\n  Choice (1-{len(opts)}): "))
        if not raw.isdigit() or not (1 <= int(raw) <= len(opts)):
            print("  ✗ Invalid choice.")
            continue

        action = opts[int(raw) - 1]
        if action.startswith("───"):
            print("  ✗ That is a section header, not an option.")
            continue

        if action == "Totals & Stats":
            show_totals()

        elif action == "List Library":
            list_entries()

        elif action == "View Movie":
            try:
                tmdb_id = int(input("  TMDB ID: ").strip())
                view_entry(tmdb_id)
            except ValueError:
                print("  ✗ Enter a numeric TMDB ID.")

        elif action == "Delete Movie":
            try:
                tmdb_id = int(input("  TMDB ID to delete: ").strip())
                delete_entry(tmdb_id)
            except ValueError:
                print("  ✗ Enter a numeric TMDB ID.")

        elif action == "Search Library":
            q = input("  Search title: ").strip()
            if q:
                list_entries(search=q)

        elif action == "Test Match (TMDB Dry Run)":
            test_match_cli()

        elif action == "Data Import / Export":
            data_submenu()

        elif action == "Configure API Keys":
            setup_api_keys()

        elif action == "Show API Keys":
            show_api_keys()

        elif action == "Exit":
            print("  Bye.")
            sys.exit(0)

        counts = count_all()


if __name__ == "__main__":
    setup_db()
    cli()
