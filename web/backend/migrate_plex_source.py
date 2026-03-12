#!/usr/bin/env python3
"""
Migration script to mark existing movies as Plex-imported.
Usage: python migrate_plex_source.py <library_name> <tmdb_id_1> <tmdb_id_2> ...
Or edit the PLEX_MOVIES dict below and run without args.
"""

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent / "movie_stats.db"

# Edit this dict with movies you want to mark as Plex-imported
# Format: {tmdb_id: "Plex Library Name"}
PLEX_MOVIES = {
    # Example:
    # 550: "Movies",      # Fight Club
    # 278: "4K Movies",   # The Shawshank Redemption
}


def migrate_plex_source(library_name: str, tmdb_ids: list[int]):
    """Mark movies as Plex-imported."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    updated = 0
    for tmdb_id in tmdb_ids:
        cursor.execute(
            "UPDATE movies SET source=?, plex_library=? WHERE tmdb_id=?",
            ("plex", library_name, tmdb_id)
        )
        if cursor.rowcount > 0:
            updated += 1
            print(f"✓ TMDB {tmdb_id}: marked as {library_name}")
        else:
            print(f"✗ TMDB {tmdb_id}: not found in database")

    conn.commit()
    conn.close()

    print(f"\n✅ Updated {updated} movies")


if __name__ == "__main__":
    if len(sys.argv) > 2:
        # Command line: python script.py "Library Name" 123 456 789
        library_name = sys.argv[1]
        tmdb_ids = [int(x) for x in sys.argv[2:]]
        migrate_plex_source(library_name, tmdb_ids)
    elif PLEX_MOVIES:
        # Edit PLEX_MOVIES above and run without args
        for tmdb_id, library_name in PLEX_MOVIES.items():
            migrate_plex_source(library_name, [tmdb_id])
    else:
        print("Usage: python migrate_plex_source.py <library_name> <tmdb_id_1> <tmdb_id_2> ...")
        print("\nOr edit PLEX_MOVIES dict in the script and run without arguments")
        print("\nExample:")
        print("  python migrate_plex_source.py 'Movies' 550 278 19404")
