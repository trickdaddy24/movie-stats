# Changelog

## [1.6.5] - 2026-03-13

### Added
- **List detail view** — Click on any list (Favorites, Watchlist, custom) to view all movies in it
- **Remove from list UI** — Hover over movies in list detail to remove them with trash icon overlay
- **List navigation** — Breadcrumb to navigate back to Lists page

## [1.6.4] - 2026-03-13

### Added
- **Quick-action list buttons on MovieCard** — Add/remove movies to Favorites (❤️) and Watchlist (🎬) directly from Library view
- Visual feedback: buttons highlight in color when movie is in list, show loading state during action

## [1.6.3] - 2026-03-13

### Fixed
- **JWT token encoding** — Convert user ID to string in JWT "sub" claim (PyJWT 2.8+ requires RFC 7519 compliance)
- Fixes 401 authentication errors when accessing protected endpoints like Lists

## [1.6.2] - 2026-03-13

### Fixed
- **Import endpoints authentication** — All `/api/import/*` endpoints now require authentication to prevent unauthorized access and premature logout when accessing Import features

## [1.6.1] - 2026-03-12

### Fixed
- **Frontend provider order** — Fixed React query context error by moving QueryClientProvider to wrap all other providers
- **Password hashing** — Switched from bcrypt to argon2-cffi to eliminate 72-byte password length limit
- **Database transaction lock** — Fixed SQLite lock errors during user registration by reusing connection for default list creation and user fetch
- **Database connection timeout** — Added 10-second timeout to SQLite connections to handle concurrent access gracefully

## [1.6.0] - 2026-03-12

### Added
- **Multi-user authentication** — JWT-based login/register with bcrypt password hashing; 7-day token expiry stored in localStorage
- **Per-user private library** — Each user has their own collection; movies are scoped by `user_id` across all queries
- **Personal lists** — Three types of lists: built-in Favorites and Watchlist (auto-created at registration), plus unlimited custom lists (user-named with optional descriptions)
- **List management API** — Full CRUD for lists + movie membership (add/remove); lists paginate and show movie counts
- **Auth pages** — Login and Register pages with error handling; protected routes redirect to login if unauthenticated
- **JWT interceptors** — Axios request interceptor attaches Bearer token; response interceptor catches 401 and redirects to login
- **AuthContext** — React context for auth state management (user info + token); persists to localStorage
- **Lists page** — Browse Favorites, Watchlist, and custom lists; create new lists inline; delete custom lists
- **Sidebar auth info** — Shows logged-in username in footer; logout button clears token and navigates to login
- **CORS fix** — Changed from wildcard `allow_origins=["*"]` to explicit localhost origins (required for credentials)

### Migration Notes
⚠️ **Breaking change:** The `movies` table now requires a `user_id` foreign key. Existing movies (added before v1.6.0) will have `user_id = NULL` and will not be visible to any user. Users must create an account and re-import their Plex/TMDB/Folder imports to populate their libraries.

### Changed
- `/api/*` endpoints now require JWT authentication (via `Authorization: Bearer <token>` header or 401 redirect)
- Database schema: added `users`, `user_lists`, `user_list_movies` tables; added `user_id` columns to `movies` and `import_sessions`
- Backend CORS: `allow_origins` now explicitly lists localhost origins instead of wildcard
- Frontend routing: public routes (/login, /register) outside Layout; protected routes inside ProtectedRoute wrapper

## [1.5.0] - 2026-03-12

### Added
- **Library Stats Dashboard** — new `/stats` route with personal analytics: at-a-glance overview cards, genre distribution chart, rating distribution, movies by decade, content ratings breakdown, added-over-time trend line, and top 5 highest-rated movies
- **Stats Page Navigation** — added "Stats" tab to sidebar between Library and Add Movie with BarChart2 icon
- **recharts Integration** — responsive charts for data visualization: horizontal bar (genres), vertical bars (ratings, decades, content ratings), and area chart (trends)
- **Aggregated SQL Queries** — efficient backend queries for all stats computed in a single `/api/stats` endpoint: overview, genres (top 15), decades, rating distribution, content ratings, monthly additions, and top-rated (100+ votes)

## [1.4.10] - 2026-03-12

### Added
- **Sorting** — dropdown with 10 sort options: Newest/Oldest Added, Title A–Z/Z–A, Rating ↓/↑, Year ↓/↑, Runtime ↓/↑; changes apply immediately; page resets to 1
- **Multi-genre filtering** — replaced single-select dropdown with clickable genre pills; users can filter by multiple genres at once (e.g., Action + Thriller); Clear button resets

### Changed
- **Library query** — `GET /api/movies` now accepts `sort_by`, `sort_dir` (asc/desc), and `genres[]` (array) parameters
- **Database sorting** — `list_movies()` validates sort column against allowlist (title, release_date, rating, runtime, added_at); default remains "newest added"

## [1.4.9] - 2026-03-12

### Added
- **Light mode toggle** — users can now switch between dark (default) and light themes, persisted to localStorage with Sun/Moon icon button in sidebar
- **Docker support** — single `docker compose up --build` command launches the full stack (backend on 8899, frontend on 80 via nginx); SQLite data persists via named volume; `.env.example` provides a template for API keys

### Changed
- **Frontend color scheme** — all 266+ hardcoded dark color classes now have light mode variants using Tailwind's `dark:` modifier (e.g., `bg-white dark:bg-slate-950`); maintains dark-first CSS paradigm but renders cleanly in both themes

## [1.4.8] - 2026-03-11

### Added
- **Content Rating (PG-13, R, etc.)** — Movies now display MPAA/BBFC content ratings fetched from TMDB's release_dates endpoint. Shows as a badge in the movie detail meta row and on movie cards
- **Plex Source Tracking** — Movies imported from Plex now track their source and Plex library name. Movie cards show a yellow "PLEX" badge; movie detail page displays "Available in [Library Name]" with Plex branding. Enables quick identification of which movies are available on your Plex server

### Changed
- **Plex import flow** — `POST /api/import/plex/start` now requires `library_name` param to track the source library; frontend automatically derives it from the selected library before starting import
- **Database schema** — Added `content_rating TEXT`, `source TEXT DEFAULT 'manual'`, and `plex_library TEXT` columns to movies table with automatic migrations for existing databases

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
