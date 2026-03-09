# Contributing to MovieStats

Thanks for your interest in contributing! This document covers how to set up the project, what we're looking for, and how to submit changes.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Conventions](#project-conventions)
- [Submitting Changes](#submitting-changes)
- [Good First Issues](#good-first-issues)

---

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/movie-stats.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Open a pull request against `main`

---

## Development Setup

### Backend

```bash
cd web/backend
pip install -r requirements.txt
cp ../../.env.example .env
# Add your TMDB_API_KEY and FANART_API_KEY to .env
python main.py
```

### Frontend

```bash
cd web/frontend
npm install
npm run dev
```

---

## Project Conventions

### Python

- Python 3.10+
- Type hints on all function signatures
- `snake_case` for functions and variables
- Keep route handlers thin — logic goes in `database.py`, `tmdb.py`, or `fanart.py`
- Return dicts from DB helpers, not raw tuples

### TypeScript / React

- Functional components only
- `camelCase` for variables and functions, `PascalCase` for components
- TanStack Query for all API calls — no raw `useEffect` fetching
- Tailwind only for styles — no inline `style=` props

### Git

- Branch names: `feature/`, `fix/`, `chore/`
- Commit messages: short imperative sentence (`Add watchlist status`, `Fix artwork refresh 404`)
- One logical change per commit

---

## Submitting Changes

- Keep PRs focused — one feature or fix per PR
- Update `CHANGELOG.md` under `[Unreleased]` with a short description
- If adding a new API route, document it briefly in your PR description
- Screenshots welcome for UI changes

---

## Good First Issues

Looking for a place to start? These are well-scoped contributions:

- Add watched / watchlist status toggle on movie cards
- Add a "Copy ID" button to the external IDs section
- Add keyboard shortcut (e.g. `/`) to focus the search bar
- Improve mobile layout of the movie detail page
- Add loading skeletons to the Library grid
- Write a `docker-compose.yml` for easy local setup

---

Questions? Open an issue and we'll help you get started.
