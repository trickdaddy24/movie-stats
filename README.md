# MovieStats

![Version](https://img.shields.io/badge/version-1.0.0-6366f1?style=flat-square)
![Python](https://img.shields.io/badge/python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)

> A personal movie library powered by **TMDB** and **fanart.tv** — search any film, save it to your local collection, and explore rich metadata, HD artwork, cast, crew, and more through a sleek dark web UI.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [API Keys](#api-keys)
- [Usage](#usage)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **TMDB Search** — find any movie by title, TMDB ID, or IMDb ID
- **HD Artwork** — posters, backdrops, logos, disc art, banners via fanart.tv
- **Full Metadata** — title, tagline, overview, runtime, release date, rating, vote count
- **Cast & Crew** — top-billed cast with photos, directors and writers
- **Genre Filtering** — browse your library filtered by genre
- **Artwork Gallery** — tabbed gallery (Posters / Backdrops / Logos) with lightbox
- **Extensible IDs** — store any external ID (TMDB, IMDb, Trakt, Letterboxd, etc.)
- **Local SQLite Library** — all data stored locally, no cloud required
- **Artwork Refresh** — re-fetch latest artwork from fanart.tv on demand
- **Dark UI** — modern Tailwind CSS dark theme, fully responsive

---

## Screenshots

> _Add screenshots here after running the app_

| Library | Movie Detail | Search |
|---------|-------------|--------|
| ![Library](docs/screenshots/library.png) | ![Detail](docs/screenshots/detail.png) | ![Search](docs/screenshots/search.png) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, SQLite (WAL mode), httpx |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Data | TMDB API v3, fanart.tv API v3 |
| State | TanStack Query (React Query v5) |
| Routing | React Router v6 |

---

## Project Structure

```
MovieStats/
├── movie.db.py              # Standalone CLI tool (legacy)
├── requirements.txt
├── .env.example
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
└── web/
    ├── backend/
    │   ├── main.py          # FastAPI app — port 8899
    │   ├── database.py      # SQLite schema + DB helpers
    │   ├── tmdb.py          # TMDB API v3 client
    │   ├── fanart.py        # fanart.tv API v3 client
    │   ├── requirements.txt
    │   └── routers/
    │       ├── search.py    # /api/search — TMDB lookup + save
    │       ├── movies.py    # /api/movies — library CRUD
    │       └── artwork.py   # /api/movies/{id}/artwork
    └── frontend/
        └── src/
            ├── App.tsx
            ├── pages/
            │   ├── Library.tsx
            │   ├── Search.tsx
            │   └── MovieDetail.tsx
            ├── components/
            │   ├── Layout.tsx
            │   ├── MovieCard.tsx
            │   └── CastCard.tsx
            └── lib/
                ├── api.ts
                └── utils.ts
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- [TMDB API key](https://www.themoviedb.org/settings/api) — free
- [fanart.tv API key](https://fanart.tv/get-an-api-key/) — free, optional

### 1. Clone

```bash
git clone https://github.com/trickdaddy24/movie-stats.git
cd movie-stats
```

### 2. Configure API Keys

```bash
cp .env.example web/backend/.env
# Edit web/backend/.env and paste your keys
```

### 3. Set Up Python Virtual Environment

A virtual environment keeps project dependencies isolated from your system Python.

**Windows:**
```bash
cd web/backend

# Create the virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate

# Your prompt will change to show (venv) — now install dependencies
pip install -r requirements.txt
```

**macOS / Linux:**
```bash
cd web/backend

# Create the virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Your prompt will change to show (venv) — now install dependencies
pip install -r requirements.txt
```

> To deactivate the virtual environment at any time, run `deactivate`.
> Always activate it again before running `python main.py` in a new terminal session.

### 4. Start Backend

```bash
# Make sure your venv is active (you should see (venv) in your prompt)
python main.py
```

Backend → **http://localhost:8899**

### 5. Start Frontend

```bash
cd web/frontend
npm install
npm run dev
```

Frontend → **http://localhost:5175**

---

## API Keys

| Service | Required | Where to get it |
|---------|----------|-----------------|
| TMDB | **Yes** | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) — free account |
| fanart.tv | No | [fanart.tv/get-an-api-key](https://fanart.tv/get-an-api-key/) — free account |

```env
# web/backend/.env
TMDB_API_KEY=your_tmdb_key_here
FANART_API_KEY=your_fanart_key_here
```

> Without fanart.tv the app still works — it falls back to TMDB images only.

---

## Usage

### Search & Add a Movie

1. Click **Search** in the sidebar
2. Type a movie title — live results appear from TMDB
3. Click **Add to Library** on any result
4. Movie saves locally with full metadata, cast, and artwork

### Browse Your Library

- **Library** — grid of all saved movies
- Search bar filters by title
- Genre dropdown filters by genre
- Click any card to open the full detail page

### Movie Detail Page

- **Hero** — backdrop with poster, rating, runtime, release date, genre badges
- **Artwork tabs** — scroll Posters / Backdrops / Logos, click to view full size
- **Cast & Crew** — profile photos, characters, directors, writers
- **External IDs** — TMDB, IMDb, and any custom source IDs
- **Refresh Artwork** — re-fetches latest art from fanart.tv
- **Delete** — removes movie from library

---

## Roadmap

- [ ] Watched / watchlist status tracking
- [ ] User ratings and personal notes
- [ ] Trakt.tv sync
- [ ] Person detail page (full filmography)
- [ ] Collection and playlist grouping
- [ ] Bulk import / export (CSV, JSON)
- [ ] Letterboxd export format
- [ ] Streaming availability via JustWatch

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, code style, and how to open a pull request.

---

## License

[MIT](LICENSE) © 2026 trickdaddy24
