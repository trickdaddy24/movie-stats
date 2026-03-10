# Changelog

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
