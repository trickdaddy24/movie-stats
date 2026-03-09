import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, Film } from 'lucide-react'
import { getMovies } from '../lib/api'
import { formatYear } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

export default function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['movies-search', query],
    queryFn: () => getMovies({ search: query, page: 1, page_size: 100 }),
  })

  const movies = data?.movies ?? []
  const total  = data?.total ?? 0
  const empty  = !isLoading && total === 0 && !query

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">Search Library</h1>

      {/* Search bar */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by title or director…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm
                     text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Empty library */}
      {empty && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-600">
          <Film className="w-14 h-14 text-slate-800" />
          <p className="text-base font-medium">No movies in library</p>
          <p className="text-sm text-slate-700">
            Use{' '}
            <a href="/import" className="text-indigo-500 hover:text-indigo-400 underline">
              Import
            </a>{' '}
            to add movies from Plex, Trakt, TMDB lists, or a local folder.
          </p>
        </div>
      )}

      {/* No results for query */}
      {!isLoading && query && movies.length === 0 && (
        <p className="text-sm text-slate-400">No results for "{query}"</p>
      )}

      {/* Result count */}
      {!isLoading && movies.length > 0 && (
        <p className="text-xs text-slate-500 mb-3">
          {movies.length} {movies.length !== total ? `of ${total} ` : ''}
          result{movies.length !== 1 ? 's' : ''}
          {query ? ` for "${query}"` : ''}
        </p>
      )}

      {/* Results */}
      <div className="space-y-2">
        {movies.map((movie) => (
          <div
            key={movie.id}
            onClick={() => navigate(`/movies/${movie.id}`)}
            className="flex gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900
                       hover:border-slate-700 hover:bg-slate-800/60 cursor-pointer transition-all"
          >
            {/* Poster */}
            <div className="flex-shrink-0">
              {movie.poster_url ? (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="w-10 h-[60px] object-cover rounded-lg"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-[60px] bg-slate-800 rounded-lg flex items-center justify-center">
                  <Film className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-slate-100 truncate">{movie.title}</h3>
                  <p className="text-xs text-slate-500">
                    {formatYear(movie.release_date)}
                    {movie.runtime ? ` · ${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : ''}
                  </p>
                </div>
                {movie.rating != null && movie.rating > 0 && (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    ★ {movie.rating.toFixed(1)}
                  </span>
                )}
              </div>
              {movie.genres?.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {movie.genres.slice(0, 3).map((g: string) => (
                    <span key={g} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
