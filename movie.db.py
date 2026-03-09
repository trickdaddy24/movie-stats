"""
movie.db.py — Movie Database CLI
Version: 1.0.0
"""

import sqlite3
import json
import csv
import logging
import datetime
import re
import sys
from pathlib import Path

VERSION = "1.0.0"
DB_FILE = "movie_db.db"
LOG_FILE = "movie_db.log"
EXPORT_DIR = Path("exports")

GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Other"]
VALID_STATUSES = ["available", "archived"]
EDITABLE_FIELDS = ["director", "release_date", "status"]

logging.basicConfig(filename=LOG_FILE, level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# ── Helpers ──────────────────────────────────────────────────────────────────

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
                status       TEXT NOT NULL DEFAULT 'available'
            )
        """)
    logging.info("DB ready")

def next_display_id(conn) -> str:
    row = conn.execute("SELECT MAX(CAST(SUBSTR(display_id, 5) AS INTEGER)) FROM movies").fetchone()[0]
    return f"mov.{(row or 0) + 1:03d}"

def count_movies() -> int:
    with get_db() as conn:
        return conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]


# ── CRUD ──────────────────────────────────────────────────────────────────────

def add_movie(title, director, genre, rating, release_date):
    errors = []
    if not title:    errors.append("title required")
    if not director: errors.append("director required")
    if genre not in GENRES: errors.append(f"genre must be one of {GENRES}")
    if not valid_rating(rating): errors.append("rating must be 1.0–10.0")
    if not valid_date(release_date): errors.append("date must be mm-dd-yyyy")
    if errors:
        for e in errors: print(f"  ✗ {e}")
        return
    with get_db() as conn:
        did = next_display_id(conn)
        conn.execute(
            "INSERT INTO movies (display_id, title, director, genre, rating, release_date, status) VALUES (?,?,?,?,?,?,?)",
            (did, title, director, genre, float(rating), release_date, "available")
        )
    print(f"✓ Added {did}: {title}")
    logging.info(f"Added {did} {title}")

def view_movie(display_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM movies WHERE display_id=?", (display_id,)).fetchone()
    if not row:
        print("No record found.")
        return
    labels = ["ID", "Title", "Director", "Genre", "Rating", "Release Date", "Status"]
    values = [row[1], row[2], row[3], row[4], f"{row[5]:.1f}", row[6], row[7]]
    for l, v in zip(labels, values):
        print(f"  {l:<14}: {v}")

def edit_movie(display_id: str, field: str, value: str):
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
    else: print("No record found.")
    logging.info(f"Edit {display_id} {field}={value}")

def delete_movie(display_id: str):
    with get_db() as conn:
        n = conn.execute("DELETE FROM movies WHERE display_id=?", (display_id,)).rowcount
    if n: print(f"✓ Deleted {display_id}")
    else: print("No record found.")
    logging.info(f"Deleted {display_id}")

def list_movies():
    with get_db() as conn:
        rows = conn.execute("SELECT display_id, title, director, genre, rating, status FROM movies ORDER BY display_id").fetchall()
    if not rows:
        print("  (no movies)")
        return
    print(f"  {'ID':<9} {'Title':<30} {'Director':<22} {'Genre':<8} {'Rating':>6}  Status")
    print("  " + "─" * 85)
    for r in rows:
        print(f"  {r[0]:<9} {r[1]:<30} {r[2]:<22} {r[3]:<8} {r[4]:>6.1f}  {r[5]}")

def search_movies(query: str):
    q = f"%{query}%"
    with get_db() as conn:
        rows = conn.execute(
            "SELECT display_id, title, director, genre, rating FROM movies WHERE title LIKE ? OR director LIKE ?", (q, q)
        ).fetchall()
    if not rows:
        print("  No results.")
        return
    for r in rows:
        print(f"  {r[0]}  {r[1]}  ({r[2]})  {r[3]}  {r[4]:.1f}")


# ── Export / Import ───────────────────────────────────────────────────────────

def export_json():
    EXPORT_DIR.mkdir(exist_ok=True)
    path = EXPORT_DIR / "movie_export.json"
    with get_db() as conn:
        rows = conn.execute("SELECT display_id,title,director,genre,rating,release_date,status FROM movies").fetchall()
    data = [{"id": r[0],"title":r[1],"director":r[2],"genre":r[3],"rating":r[4],"release_date":r[5],"status":r[6]} for r in rows]
    path.write_text(json.dumps(data, indent=2))
    print(f"✓ Exported {len(data)} movies → {path}")
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
                "INSERT OR REPLACE INTO movies (display_id,title,director,genre,rating,release_date,status) VALUES (?,?,?,?,?,?,?)",
                (m["id"], m["title"], m["director"], m.get("genre","Other"), float(m["rating"]), m["release_date"], m["status"])
            )
            imported += 1
    print(f"✓ Imported {imported}, skipped {skipped}")
    logging.info(f"JSON import: {imported} in, {skipped} skipped")

def export_csv():
    EXPORT_DIR.mkdir(exist_ok=True)
    path = EXPORT_DIR / "movie_export.csv"
    with get_db() as conn:
        rows = conn.execute("SELECT display_id,title,director,genre,rating,release_date,status FROM movies").fetchall()
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["display_id","title","director","genre","rating","release_date","status"])
        w.writerows(rows)
    print(f"✓ Exported {len(rows)} movies → {path}")
    logging.info(f"Exported {len(rows)} to CSV")

def import_csv():
    path = EXPORT_DIR / "movie_export.csv"
    if not path.exists():
        print(f"  ✗ {path} not found")
        return
    imported = skipped = 0
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    with get_db() as conn:
        for m in rows:
            try:
                rating = float(m["rating"])
                if not all([m["title"], m["director"], valid_rating(rating),
                            valid_date(m["release_date"]), m["status"] in VALID_STATUSES]):
                    raise ValueError("invalid fields")
                conn.execute(
                    "INSERT OR REPLACE INTO movies (display_id,title,director,genre,rating,release_date,status) VALUES (?,?,?,?,?,?,?)",
                    (m["display_id"], m["title"], m["director"], m["genre"], rating, m["release_date"], m["status"])
                )
                imported += 1
            except (ValueError, KeyError) as e:
                print(f"  ✗ Skipping {m.get('display_id','?')}: {e}")
                skipped += 1
    print(f"✓ Imported {imported}, skipped {skipped}")
    logging.info(f"CSV import: {imported} in, {skipped} skipped")


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
            n = int(input("  Genre (1-5): "))
            if 1 <= n <= 5:
                g = GENRES[n - 1]
                if g == "Other":
                    custom = clean(input("  Custom genre name: "))
                    return custom or "Other"
                return g
        except ValueError:
            pass
        print("  ✗ Enter 1–5.")

def get_display_id(prompt_text="Movie ID (e.g. mov.001)") -> str:
    raw = clean(input(f"  {prompt_text}: ")).lower()
    if not raw.startswith("mov."):
        raw = f"mov.{raw.zfill(3)}"
    return raw

def cli():
    print(f"\n=== Movie Database  v{VERSION} ===")
    while True:
        has = count_movies() > 0
        opts = ["Add Movie"]
        if has: opts += ["List All", "View Movie", "Edit Movie", "Delete Movie", "Search"]
        opts += ["Export JSON", "Import JSON", "Export CSV", "Import CSV", "Exit"]

        print()
        for i, o in enumerate(opts, 1):
            print(f"  {i}. {o}")
        raw = clean(input(f"  Choice (1-{len(opts)}): "))
        if not raw.isdigit() or not (1 <= int(raw) <= len(opts)):
            print("  ✗ Invalid choice.")
            continue
        action = opts[int(raw) - 1]

        if action == "Add Movie":
            title  = prompt("Title")
            director = prompt("Director")
            genre  = pick_genre()
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
            add_movie(title, director, genre, rating, rd)

        elif action == "List All":
            list_movies()

        elif action == "View Movie":
            view_movie(get_display_id())

        elif action == "Edit Movie":
            did = get_display_id()
            print(f"  Editable: {', '.join(EDITABLE_FIELDS)}")
            field = clean(input("  Field: "))
            value = clean(input(f"  New {field}: "))
            edit_movie(did, field, value)

        elif action == "Delete Movie":
            did = get_display_id()
            confirm = clean(input(f"  Delete {did}? (yes/no): "))
            if confirm.lower() == "yes":
                delete_movie(did)
            else:
                print("  Cancelled.")

        elif action == "Search":
            search_movies(prompt("Search (title or director)"))

        elif action == "Export JSON": export_json()
        elif action == "Import JSON": import_json()
        elif action == "Export CSV":  export_csv()
        elif action == "Import CSV":  import_csv()

        elif action == "Exit":
            print("  Bye.")
            sys.exit(0)


if __name__ == "__main__":
    setup_db()
    cli()
