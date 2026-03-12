import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, FlaskConical, CheckCircle, AlertCircle, Info, ChevronRight, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  tmdb_id: number
  title: string
  year: number | null
  overview: string
  rating: number | null
  vote_count: number | null
  poster_url: string
  score: number
  confidence: 'excellent' | 'good' | 'fair' | 'low'
}

interface DryRunResult {
  query_title: string
  query_year: number | null
  total_found: number
  candidates: Candidate[]
}

interface LiveResult {
  tmdb_id: number
  imdb_id: string | null
  title: string
  original_title: string | null
  tagline: string | null
  overview: string | null
  release_date: string | null
  runtime: number | null
  rating: number | null
  vote_count: number | null
  genres: string[]
  poster_url: string | null
  backdrop_url: string | null
  cast_count: number
  crew_count: number
  cast_preview: { name: string; character: string }[]
  crew_preview: { name: string; job: string }[]
  artwork_summary: Record<string, number>
  artwork_total: number
  external_ids: Record<string, string>
  would_save: {
    movies_row: boolean
    cast_crew_rows: number
    genre_rows: number
    artwork_rows: number
    external_id_rows: number
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<string, string> = {
  excellent: 'bg-green-900/40 text-green-400 border-green-800',
  good:      'bg-blue-900/40  text-blue-400  border-blue-800',
  fair:      'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  low:       'bg-red-900/40   text-red-400   border-red-800',
}

function ScoreBadge({ score, confidence }: { score: number; confidence: string }) {
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.low}`}>
      {score}% {confidence}
    </span>
  )
}

function formatRuntime(mins: number | null) {
  if (!mins) return '—'
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Live result panel ─────────────────────────────────────────────────────────

function LivePanel({ tmdbId }: { tmdbId: number }) {
  const { data, isLoading, isError } = useQuery<LiveResult>({
    queryKey: ['test-fetch', tmdbId],
    queryFn: () => api.get(`/test/fetch/${tmdbId}`).then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 dark:text-slate-400 py-8 justify-center">
      <Loader2 className="w-5 h-5 animate-spin" /> Fetching from TMDB + fanart.tv…
    </div>
  )

  if (isError || !data) return (
    <p className="text-red-400 text-sm">Failed to fetch movie details.</p>
  )

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex gap-4">
        {data.poster_url && (
          <img src={data.poster_url} alt={data.title}
            className="w-24 rounded-lg object-cover flex-shrink-0" />
        )}
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white">{data.title}</h3>
          {data.tagline && <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400 italic">{data.tagline}</p>}
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400">
            <span>{data.release_date?.slice(0, 4) ?? '—'}</span>
            <span>·</span>
            <span>{formatRuntime(data.runtime)}</span>
            {data.rating && <><span>·</span><span>★ {data.rating.toFixed(1)}</span></>}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {data.genres.map(g => (
              <span key={g} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 dark:text-slate-400 rounded border border-slate-300 dark:border-slate-700">{g}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Overview */}
      {data.overview && (
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{data.overview}</p>
      )}

      {/* What would be saved */}
      <div className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">What would be saved to DB</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Movies row',     '1'],
            ['Cast + Crew',    String(data.would_save.cast_crew_rows)],
            ['Genres',         String(data.would_save.genre_rows)],
            ['Artwork rows',   String(data.would_save.artwork_rows)],
            ['External IDs',   String(data.would_save.external_id_rows)],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between bg-slate-50 dark:bg-slate-900 rounded px-3 py-1.5">
              <span className="text-slate-500 dark:text-slate-500 dark:text-slate-400">{label}</span>
              <span className="text-white font-mono">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Artwork breakdown */}
      {Object.keys(data.artwork_summary).length > 0 && (
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Artwork ({data.artwork_total} total)
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.artwork_summary).map(([type, count]) => (
              <span key={type} className="text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {type} × {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cast preview */}
      {data.cast_preview.length > 0 && (
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Cast ({data.cast_count} total — showing first 5)
          </p>
          <div className="space-y-1">
            {data.cast_preview.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-200">{p.name}</span>
                <span className="text-slate-500 dark:text-slate-500 text-xs">{p.character}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External IDs */}
      <div className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">External IDs</p>
        <div className="space-y-1 font-mono text-xs">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-500">tmdb</span><span className="text-slate-700 dark:text-slate-300">{data.tmdb_id}</span></div>
          {data.imdb_id && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-500">imdb</span><span className="text-slate-700 dark:text-slate-300">{data.imdb_id}</span></div>}
          {Object.entries(data.external_ids).filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex justify-between"><span className="text-slate-500 dark:text-slate-500">{k}</span><span className="text-slate-700 dark:text-slate-300">{v}</span></div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        This is a preview only — nothing was saved to the database.
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TestMatch() {
  const [title, setTitle]       = useState('')
  const [year, setYear]         = useState('')
  const [submitted, setSubmitted] = useState<{ title: string; year: number | null } | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: dryRun, isLoading: searching, isError } = useQuery<DryRunResult>({
    queryKey: ['test-match', submitted?.title, submitted?.year],
    queryFn: () => {
      const params = new URLSearchParams({ title: submitted!.title })
      if (submitted!.year) params.set('year', String(submitted!.year))
      return api.get(`/test/match?${params}`).then(r => r.data)
    },
    enabled: !!submitted,
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitted({ title: title.trim(), year: year ? parseInt(year) : null })
    setSelectedId(null)
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <FlaskConical className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white
">TMDB Match Test</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400 mb-6">
        Test how a movie title matches against TMDB before importing. Nothing is saved.
      </p>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-500" />
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Movie title (e.g. Inception)"
            autoFocus
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm
                       text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <input
          type="number"
          value={year}
          onChange={e => setYear(e.target.value)}
          placeholder="Year"
          className="w-24 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm
                     text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!title.trim() || searching}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white
                     text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Dry Run
        </button>
      </form>

      {isError && (
        <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
          <AlertCircle className="w-4 h-4" /> Search failed — check your TMDB API key.
        </div>
      )}

      {dryRun && (
        <div className="flex gap-6">

          {/* Candidates list */}
          <div className="flex-1 min-w-0 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {dryRun.total_found.toLocaleString()} results from TMDB — showing top {dryRun.candidates.length} with match scores
            </p>
            {dryRun.candidates.map(c => (
              <div
                key={c.tmdb_id}
                onClick={() => setSelectedId(selectedId === c.tmdb_id ? null : c.tmdb_id)}
                className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedId === c.tmdb_id
                    ? 'border-indigo-500 bg-slate-100 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800/60'
                }`}
              >
                {c.poster_url ? (
                  <img src={c.poster_url} alt={c.title} className="w-10 h-[60px] object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-10 h-[60px] bg-slate-100 dark:bg-slate-800 rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{c.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">{c.year ?? '—'} · TMDB {c.tmdb_id}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ScoreBadge score={c.score} confidence={c.confidence} />
                      <ChevronRight className={`w-4 h-4 text-slate-400 dark:text-slate-600 transition-transform ${selectedId === c.tmdb_id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  {c.overview && (
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-2">{c.overview}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Live fetch panel */}
          {selectedId && (
            <div className="w-96 flex-shrink-0 self-start sticky top-6">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-slate-200">Live Test — Full Fetch</span>
                </div>
                <LivePanel tmdbId={selectedId} />
              </div>
            </div>
          )}

        </div>
      )}

      {!submitted && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-700">
          <FlaskConical className="w-12 h-12 text-slate-800" />
          <p className="text-sm">Enter a title above and click Dry Run to test TMDB matching</p>
        </div>
      )}
    </div>
  )
}
