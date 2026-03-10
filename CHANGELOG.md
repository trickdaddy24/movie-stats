# Changelog

## [1.4.7] - 2026-03-10

### Fixed
- **Plex preview/import returning 0 movies** — `get_library_movies` now passes `includeGuids=1` query param so Plex includes the `Guid` list (tmdb://, imdb:// IDs) in the bulk `/all` response; without this param the list was always absent
- **Plex TMDB fallback used wrong key** — `candidate.get("id")` changed to `candidate.get("tmdb_id")` to match `tmdb.search_movies()` output; affected movies without a Plex-matched GUID
- **Folder import TMDB resolution KeyError** — `hit["id"]` changed to `hit["tmdb_id"]` in `_resolve_folder_movies`; caused `KeyError: 'id'` logged as `"Search error for 'Movie': 'id'"` and silently dropped all unresolved files

## [1.4.6] - 2026-03-09

### Fixed
- **Add Movie** (`/search`) now actually searches TMDB and adds movies — previous implementation was searching the local library with no add button; rewritten to call `GET /api/search` and `POST /api/search/add/{tmdb_id}`, with spinner, "Add" button per result, and "In Library" state after adding
- **Wikidata external ID** now renders as a clickable link (`https://www.wikidata.org/wiki/{id}`) on the Movie Detail page; Facebook, Instagram, and Twitter IDs also get proper links

## [1.4.5] - 2026-03-09

### Changed
- Sidebar nav "Search" renamed to "Add Movie" with a PlusCircle icon — makes the add-movie flow immediately discoverable

## [1.4.4] - 2026-03-09

### Fixed
- Folder import "Refresh Posters" now re-fetches artwork for all movies, not just ones missing a poster row
- `_resolve_folder_movies` now tracks the last API exception and surfaces it in the done event — previously a 401 or network error was silently swallowed and showed as "no matches"
- `scanner.py` — separators (`._-`) normalized to spaces before year extraction so `Movie_2008` and `Movie.2008` correctly detect the year; year regex also handles `(2008)` and `[2008]` bracket wrapping; dangling `(` and `[` stripped after year cut (e.g. `Disaster Movie (2008).mkv` no longer produces title `"Disaster Movie ("`)
- `movie.db.py` Search & Add (option 6) — results table was showing blank TMDB ID because `r.get('id')` was used instead of `r.get('tmdb_id')`; also now shows rating and a short overview line per result to match UI search

## [1.4.3] - 2026-03-09

### Added
- **Refresh Posters** button in the Library header — re-fetches TMDB + fanart.tv artwork for all movies that currently have no poster stored; runs in a background thread and auto-refreshes the grid after ~8 seconds
- `POST /api/movies/refresh-all-artwork` backend endpoint — finds movies missing a poster, fetches artwork in a daemon thread, returns immediately
- `refreshAllArtwork()` API helper in `api.ts`

## [1.4.2] - 2026-03-09

### Added
- Red **Stop Import** button in all import progress views — cancels the job after the current movie finishes
- `POST /api/import/cancel/{job_id}` backend endpoint — sets a `cancelled` flag checked each iteration of the import loop
- `cancelImport` API function in `api.ts`
- `cancel` callback in `useImportProgress` hook — posts cancel, closes SSE connection, marks import done with reason

### Fixed
- Plex "Import All" did not import anything when using saved credentials — frontend sent an empty token string; backend now falls back to `PLEX_TOKEN` env var before starting the job
- Plex library fetch now runs in `_run_plex_import` background thread so the HTTP response returns immediately (same pattern as folder import), preventing timeout on large libraries

## [1.4.1] - 2026-03-09

### Fixed
- All import start endpoints now check TMDB API key upfront and return a clear 400 error instead of starting a job that silently fails with "N failed"
- `_run_folder_import` includes a `reason` field in the done event when no TMDB matches are found, so the UI can show exactly why it failed
- `_run_import` includes the exception message as `reason` in each failed progress event
- `useImportProgress` captures `reason` from done and progress events into state
- `ImportProgress` shows per-item failure reasons in the log panel and a top-level banner when the whole job fails with a reason

## [1.4.0] - 2026-03-09

### Added
- `movie.db.py` — Search & Add Movie (➕): search TMDB by title and optional year, pick from results, save full movie with cast/crew/artwork/external IDs to library
- `movie.db.py` — `add_movie_to_db()` helper that writes all related tables (cast_crew, genres, artwork, external_ids) in one transaction
- `movie.db.py` — emoji menu (📊 📚 🎬 🗑️ 🔍 ➕ 🧪 📦 🔑 👁️ 🚪) with tuple-based dispatch, removing fragile string matching
- `movie.db.py` — Exit is now always `0` regardless of how many menu items are visible
- `movie.db.py` — Removed "Settings" section header from menu; Configure/Show API Keys remain as numbered items
- `movie.db.py` — Data submenu also uses emoji and exit via `0`

### Fixed
- Folder import "Import All" was broken — TMDB resolution happened synchronously in the HTTP request handler (one API call per file), causing timeouts and 400 errors on large folders; resolution now runs inside the background thread so the job starts immediately
- SSE `onerror` in `useImportProgress` silently wiped the progress state if the connection dropped before the `done` event, making it look like nothing happened; now `onerror` marks the import as done so progress stays visible

## [1.3.0] - 2026-03-09

### Added
- Rate limit detection for TMDB — `TMDBRateLimitError` exception with `Retry-After` support; all routers return HTTP 429 (not 502) when rate limited, with `Retry-After` header forwarded to the client
- Rate limit detection for fanart.tv — 429 responses logged with retry time instead of silently swallowed; all HTTP and unexpected errors now logged with context
- `WARNING` log lines for both services so rate limit hits are immediately visible in the backend terminal and log files

### Fixed
- `TestMatch.tsx` imported `api` as a default export but `api.ts` had no default export — `api` was `undefined` at runtime, crashing the Test Match page; fixed by exporting `api` as a named export and updating the import
- `GET /api/search` had no error handling — a TMDB failure would crash with an unhandled exception; now wrapped with proper 429/502 responses

## [1.2.0] - 2026-03-08

### Added
- Local folder scan import — scans OS directory for movie files, parses titles/years from filenames, matches via TMDB search
- SSE streaming progress for all import sources (TMDB List, Trakt, Plex, Folder)
- Progress bar with percentage fill, current movie name, and live ETA countdown
- Import log panel — live scrolling list of imported/skipped/failed movies (monospace, color-coded)
- `import_sessions` DB table — persists import history (source, counts, log)
- `GET /api/import/sessions` — returns recent import history
- `scanner.py` — movie filename parser (strips codec tags, extracts year, cleans title)
- `useImportProgress` hook — manages EventSource lifecycle and ETA calculation
- `ImportProgress` component — reusable progress UI used across all four import tabs
- `import.log` file logging for all import activity

## [1.1.0] - 2026-03-08

### Added
- Bulk import from TMDB Lists (by list ID or URL)
- Bulk import from Trakt.tv (user lists and watchlists)
- Bulk import from Plex Media Server (via local API + Plex token)
- `/api/import/*` router with preview + import endpoints for all three sources
- Import page with three-tab UI — TMDB List, Trakt, Plex
- Import result summary (imported / skipped / failed counts)
- `trakt.py` — Trakt API v2 client
- `plex.py` — Plex Media Server API client with GUID parsing

## [1.0.0] - 2026-03-08

### Added
- Initial release
- TMDB integration: search, full details, cast/crew, images
- fanart.tv integration: HD posters, backdrops, logos, disc art
- Local SQLite library with extensible external IDs
- FastAPI backend with search, movies, and artwork routers
- React + Vite frontend: Library, Search, and Movie Detail pages
- Artwork gallery with tabs (posters/backdrops/logos) and lightbox viewer
- Cast and crew display with profile photos and fallback initials
- Paginated library grid with search and genre filtering
- Delete from library and refresh artwork actions
- External IDs panel with clickable links to TMDB and IMDb
