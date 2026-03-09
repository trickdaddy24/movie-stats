# Changelog

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
