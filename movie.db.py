"""
movie.db.py — Movie Database CLI
Version: 1.1.0
"""

import sqlite3
import json
import csv
import logging
import datetime
import re
import sys
from pathlib import Path

VERSION = "1.1.0"
DB_FILE = "movie_db.db"
LOG_FILE = "movie_db.log"
EXPORT_DIR = Path("exports")
ENV_PATH = Path(__file__).parent / "web" / "backend" / ".env"

GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller", "Romance", "Documentary", "Animation", "Other"]
VALID_STATUSES = ["available", "archived"]
EDITABLE_FIELDS = ["director", "release_date", "status"]

MEDIA_TYPES = ["movie", "show"]

API_KEYS = [
    {
        "key":      "TMDB_API_KEY",
        "label":    "TMDB API Key",
        "required": True,
        "hint":     "https://www.themoviedb.org/settings/api",
    },
    {
        "key":      "FANART_API_KEY",
        "label":    "fanart.tv API Key",
        "required": False,
        "hint":     "https://fanart.tv/get-an-api-key/",
    },
    {
        "key":      "TRAKT_CLIENT_ID",
        "label":    "Trakt Client ID",
        "required": False,
        "hint":     "https://trakt.tv/oauth/applications",
    },
    {
        "key":      "PLEX_URL",
        "label":    "Plex Server URL",
        "required": False,
        "hint":     "e.g. http://192.168.1.100:32400",
    },
    {
        "key":      "PLEX_TOKEN",
        "label":    "Plex Token",
        "required": False,
        "hint":     "https://support.plex.tv/articles/204059436/",
    },
]

logging.basicConfig(filename=LOG_FILE, level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# ── Helpers ───────────────────────────────────────────────────────────────────

def clean(value: str) -> str:
    return re.sub(r'[;\"\'\\]', '', value.strip()) if value else ""

def valid_rating(r) -> bool:
    try: return 1.0 <= float(r) <= 10.0
    except (ValueError, TypeError): return False

def valid_date(d: str) -> bool:
    try:
        return bool(re.match(r'^\d{2}-\d{2}-\d{4}$', d)) and bool(datetime.datetime.strptime(d, "%m-%d-%Y"))
    except ValueError:
        return False


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    return sqlite3.connect(DB_FILE)

def setup_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS movies (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                display_id   TEXT UNIQUE,
                title        TEXT NOT NULL,
                director     TEXT NOT NULL,
                genre        TEXT NOT NULL,
                rating       REAL NOT NULL,
                release_date TEXT NOT NULL,
                status       TEXT NOT NULL DEFAULT 'available',
                media_type   TEXT NOT NULL DEFAULT 'movie'
            )
        """)
        # migrate: add media_type column to existing DBs
        try:
            conn.execute("ALTER TABLE movies ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'")
        except sqlite3.OperationalError:
            pass
    logging.info("DB ready")

def next_display_id(conn, media_type: str) -> str:
    prefix = "mov" if media_type == "movie" else "shw"
    row = conn.execute(
        f"SELECT MAX(CAST(SUBSTR(display_id, 5) AS INTEGER)) FROM movies WHERE media_type=?", (media_type,)
    ).fetchone()[0]
    return f"{prefix}.{(row or 0) + 1:03d}"

def count_all() -> dict:
    with get_db() as conn:
        movies = conn.execute("SELECT COUNT(*) FROM movies WHERE media_type='movie'").fetchone()[0]
        shows  = conn.execute("SELECT COUNT(*) FROM movies WHERE media_type='show'").fetchone()[0]
    return {"movies": movies, "shows": shows, "total": movies + shows}


# ── CRUD ──────────────────────────────────────────────────────────────────────

def add_entry(title, director, genre, rating, release_date, media_type="movie"):
    errors = []
    if not title:    errors.append("title required")
    if not director: errors.append("director required")
    if genre not in GENRES: errors.append(f"genre must be one of: {', '.join(GENRES)}")
    if not valid_rating(rating): errors.append("rating must be 1.0–10.0")
    if not valid_date(release_date): errors.append("date must be mm-dd-yyyy")
    if media_type not in MEDIA_TYPES: errors.append(f"type must be: {', '.join(MEDIA_TYPES)}")
    if errors:
        for e in errors: print(f"  ✗ {e}")
        return
    with get_db() as conn:
        did = next_display_id(conn, media_type)
        conn.execute(
            "INSERT INTO movies (display_id, title, director, genre, rating, release_date, status, media_type) VALUES (?,?,?,?,?,?,?,?)",
            (did, title, director, genre, float(rating), release_date, "available", media_type)
        )
    label = "Movie" if media_type == "movie" else "Show"
    print(f"✓ Added {label} {did}: {title}")
    logging.info(f"Added {did} {title} [{media_type}]")

def view_entry(display_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM movies WHERE display_id=?", (display_id,)).fetchone()
    if not row:
        print("  No record found.")
        return
    labels = ["ID", "Title", "Director", "Genre", "Rating", "Release Date", "Status", "Type"]
    values = [row[1], row[2], row[3], row[4], f"{row[5]:.1f}", row[6], row[7], row[8]]
    for l, v in zip(labels, values):
        print(f"  {l:<14}: {v}")

def edit_entry(display_id: str, field: str, value: str):
    if field not in EDITABLE_FIELDS:
        print(f"  ✗ Editable fields: {', '.join(EDITABLE_FIELDS)}")
        return
    if field == "release_date" and not valid_date(value):
        print("  ✗ Date must be mm-dd-yyyy")
        return
    if field == "status" and value not in VALID_STATUSES:
        print(f"  ✗ Status must be: {', '.join(VALID_STATUSES)}")
        return
    with get_db() as conn:
        n = conn.execute(f"UPDATE movies SET {field}=? WHERE display_id=?", (value, display_id)).rowcount
    if n: print(f"✓ Updated {display_id}")
    else: print("  No record found.")
    logging.info(f"Edit {display_id} {field}={value}")

def delete_entry(display_id: str):
    with get_db() as conn:
        n = conn.execute("DELETE FROM movies WHERE display_id=?", (display_id,)).rowcount
    if n: print(f"✓ Deleted {display_id}")
    else: print("  No record found.")
    logging.info(f"Deleted {display_id}")

def list_entries(media_type: str = None):
    query = "SELECT display_id, title, director, genre, rating, status, media_type FROM movies"
    params = ()
    if media_type:
        query += " WHERE media_type=?"
        params = (media_type,)
    query += " ORDER BY media_type, display_id"
    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
    if not rows:
        print("  (no records)")
        return
    print(f"  {'ID':<9} {'Type':<6} {'Title':<28} {'Director':<20} {'Genre':<12} {'Rating':>6}  Status")
    print("  " + "─" * 95)
    for r in rows:
        print(f"  {r[0]:<9} {r[6]:<6} {r[1]:<28} {r[2]:<20} {r[3]:<12} {r[4]:>6.1f}  {r[5]}")

def search_entries(query: str):
    q = f"%{query}%"
    with get_db() as conn:
        rows = conn.execute(
            "SELECT display_id, title, director, genre, rating, media_type FROM movies WHERE title LIKE ? OR director LIKE ?", (q, q)
        ).fetchall()
    if not rows:
        print("  No results.")
        return
    for r in rows:
        print(f"  {r[0]}  [{r[5]}]  {r[1]}  ({r[2]})  {r[3]}  {r[4]:.1f}")

def show_totals():
    counts = count_all()
    print(f"\n  {'Movies':<10}: {counts['movies']}")
    print(f"  {'Shows':<10}: {counts['shows']}")
    print(f"  {'Total':<10}: {counts['total']}")
    with get_db() as conn:
        genres = conn.execute(
            "SELECT genre, COUNT(*) FROM movies GROUP BY genre ORDER BY COUNT(*) DESC"
        ).fetchall()
        statuses = conn.execute(
            "SELECT status, COUNT(*) FROM movies GROUP BY status"
        ).fetchall()
    if genres:
        print(f"\n  By Genre:")
        for g, c in genres:
            print(f"    {g:<16}: {c}")
    if statuses:
        print(f"\n  By Status:")
        for s, c in statuses:
            print(f"    {s:<16}: {c}")


# ── Export / Import ───────────────────────────────────────────────────────────

def export_json():
    EXPORT_DIR.mkdir(exist_ok=True)
    path = EXPORT_DIR / "movie_export.json"
    with get_db() as conn:
        rows = conn.execute("SELECT display_id,title,director,genre,rating,release_date,status,media_type FROM movies").fetchall()
    data = [{"id":r[0],"title":r[1],"director":r[2],"genre":r[3],"rating":r[4],"release_date":r[5],"status":r[6],"media_type":r[7]} for r in rows]
    path.write_text(json.dumps(data, indent=2))
    print(f"✓ Exported {len(data)} entries → {path}")
    logging.info(f"Exported {len(data)} to JSON")

def import_json():
    path = EXPORT_DIR / "movie_export.json"
    if not path.exists():
        print(f"  ✗ {path} not found")
        return
    data = json.loads(path.read_text())
    imported = skipped = 0
    with get_db() as conn:
        for m in data:
            if not all([m.get("title"), m.get("director"), valid_rating(m.get("rating")),
                        valid_date(m.get("release_date", "")), m.get("status","") in VALID_STATUSES]):
                print(f"  ✗ Skipping {m.get('id','?')}: invalid data")
                skipped += 1
                continue
            conn.execute(
                "INSERT OR REPLACE INTO movies (display_id,title,director,genre,rating,release_date,status,media_type) VALUES (?,?,?,?,?,?,?,?)",
                (m["id"], m["title"], m["director"], m.get("genre","Other"), float(m["rating"]),
                 m["release_date"], m["status"], m.get("media_type","movie"))
            )
            imported += 1
    print(f"✓ Imported {imported}, skipped {skipped}")
    logging.info(f"JSON import: {imported} in, {skipped} skipped")

def export_csv():
    EXPORT_DIR.mkdir(exist_ok=True)
    path = EXPORT_DIR / "movie_export.csv"
    with get_db() as conn:
        rows = conn.execute("SELECT display_id,title,director,genre,rating,release_date,status,media_type FROM movies").fetchall()
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["display_id","title","director","genre","rating","release_date","status","media_type"])
        w.writerows(rows)
    print(f"✓ Exported {len(rows)} entries → {path}")
    logging.info(f"Exported {len(rows)} to CSV")

def import_csv():
    path = EXPORT_DIR / "movie_export.csv"
    if not path.exists():
        print(f"  ✗ {path} not found")
        return
    imported = skipped = 0
    with path.open(newline="") as f:
        rows = list(csv.DictReader(f))
    with get_db() as conn:
        for m in rows:
            try:
                rating = float(m["rating"])
                if not all([m["title"], m["director"], valid_rating(rating),
                            valid_date(m["release_date"]), m["status"] in VALID_STATUSES]):
                    raise ValueError("invalid fields")
                conn.execute(
                    "INSERT OR REPLACE INTO movies (display_id,title,director,genre,rating,release_date,status,media_type) VALUES (?,?,?,?,?,?,?,?)",
                    (m["display_id"], m["title"], m["director"], m["genre"], rating,
                     m["release_date"], m["status"], m.get("media_type","movie"))
                )
                imported += 1
            except (ValueError, KeyError) as e:
                print(f"  ✗ Skipping {m.get('display_id','?')}: {e}")
                skipped += 1
    print(f"✓ Imported {imported}, skipped {skipped}")
    logging.info(f"CSV import: {imported} in, {skipped} skipped")


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

    print("\n  Summary:")
    for cfg in API_KEYS:
        val = values.get(cfg["key"], "")
        display = (val[:4] + "*" * max(0, len(val) - 4)) if val else "(not set)"
        print(f"    {cfg['label']:<22}  {display}")

    confirm = input("\n  Save to .env? (yes/no): ").strip().lower()
    if confirm in ("yes", "y"):
        write_env(values)
        print(f"  ✓ Saved to {ENV_PATH}")
        logging.info("API keys updated via CLI")
    else:
        print("  Cancelled.")

def show_api_keys():
    existing = read_env()
    if not existing:
        print(f"  No .env found at {ENV_PATH}")
        print("  Run 'Configure API Keys' to set them up.")
        return
    print(f"\n  Current API Keys  ({ENV_PATH})\n")
    for cfg in API_KEYS:
        val = existing.get(cfg["key"], "")
        tag = "[required]" if cfg["required"] else "[optional]"
        if val:
            masked = val[:4] + "*" * max(0, len(val) - 4)
            status = f"✓  {masked}"
        else:
            status = "—  not set"
        print(f"  {cfg['label']:<22} {tag:<12}  {status}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def prompt(label: str, required=True) -> str:
    while True:
        val = clean(input(f"  {label}: "))
        if val or not required:
            return val
        print("  ✗ Required.")

def pick_genre() -> str:
    for i, g in enumerate(GENRES, 1):
        print(f"  {i}. {g}")
    while True:
        try:
            n = int(input(f"  Genre (1-{len(GENRES)}): "))
            if 1 <= n <= len(GENRES):
                g = GENRES[n - 1]
                if g == "Other":
                    custom = clean(input("  Custom genre name: "))
                    return custom or "Other"
                return g
        except ValueError:
            pass
        print(f"  ✗ Enter 1–{len(GENRES)}.")

def pick_media_type() -> str:
    print("  1. Movie")
    print("  2. Show")
    while True:
        val = clean(input("  Type (1/2): "))
        if val == "1": return "movie"
        if val == "2": return "show"
        print("  ✗ Enter 1 or 2.")

def get_display_id(prompt_text="ID (e.g. mov.001 or shw.001)") -> str:
    raw = clean(input(f"  {prompt_text}: ")).lower()
    if not raw.startswith(("mov.", "shw.")):
        raw = f"mov.{raw.zfill(3)}"
    return raw

def cli():
    counts = count_all()
    print(f"\n=== Movie Database  v{VERSION} ===")
    print(f"  Movies: {counts['movies']}  |  Shows: {counts['shows']}  |  Total: {counts['total']}")

    while True:
        has = counts["total"] > 0
        opts = ["Add Entry", "Totals & Stats"]
        if has: opts += ["List All", "List Movies", "List Shows", "View Entry", "Edit Entry", "Delete Entry", "Search"]
        opts += ["Export JSON", "Import JSON", "Export CSV", "Import CSV"]
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

        if action == "Add Entry":
            media_type = pick_media_type()
            title    = prompt("Title")
            director = prompt("Director / Creator")
            genre    = pick_genre()
            while True:
                try:
                    rating = float(input("  Rating (1.0-10.0): "))
                    if valid_rating(rating): break
                except ValueError: pass
                print("  ✗ Must be 1.0–10.0.")
            while True:
                rd = clean(input("  Release date (mm-dd-yyyy): "))
                if valid_date(rd): break
                print("  ✗ Must be mm-dd-yyyy.")
            add_entry(title, director, genre, rating, rd, media_type)

        elif action == "Totals & Stats":
            show_totals()

        elif action == "List All":
            list_entries()

        elif action == "List Movies":
            list_entries("movie")

        elif action == "List Shows":
            list_entries("show")

        elif action == "View Entry":
            view_entry(get_display_id())

        elif action == "Edit Entry":
            did = get_display_id()
            print(f"  Editable: {', '.join(EDITABLE_FIELDS)}")
            field = clean(input("  Field: "))
            value = clean(input(f"  New {field}: "))
            edit_entry(did, field, value)

        elif action == "Delete Entry":
            did = get_display_id()
            confirm = clean(input(f"  Delete {did}? (yes/no): "))
            if confirm.lower() == "yes":
                delete_entry(did)
            else:
                print("  Cancelled.")

        elif action == "Search":
            search_entries(prompt("Search (title or director)"))

        elif action == "Export JSON": export_json()
        elif action == "Import JSON": import_json()
        elif action == "Export CSV":  export_csv()
        elif action == "Import CSV":  import_csv()

        elif action == "Configure API Keys":
            setup_api_keys()

        elif action == "Show API Keys":
            show_api_keys()

        elif action == "Exit":
            print("  Bye.")
            sys.exit(0)

        # refresh counts after any action that might change DB
        counts = count_all()


if __name__ == "__main__":
    setup_db()
    cli()
