import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search as SearchIcon, Film, Plus, CheckCircle, Loader2 } from 'lucide-react'
import { searchTMDB, addMovie } from '../lib/api'
import { formatYear } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

export default function AddMoviePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [addedIds, setAddedIds] = useState<Map<number, number>>(new Map()) // tmdb_id -> library_id

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tmdb-search', query],
    queryFn: () => searchTMDB(query),
    enabled: query.trim().length > 1,
    staleTime: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: (tmdbId: number) => addMovie(tmdbId),
    onSuccess: (result) => {
      setAddedIds((prev) => new Map(prev).set(result.tmdb_id, result.id))
      qc.invalidateQueries({ queryKey: ['movies'] })
    },
  })

  const results = data?.results ?? []
  const searching = isLoading || isFetching

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white
 mb-6">Add Movie</h1>

      {/* Search bar */}
      <div className="relative mb-6">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-500 animate-spin" />
        ) : (
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-500" />
        )}
        <input
          type="text"
          placeholder="Search TMDB by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm
                     text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Results count */}
      {results.length > 0 && data?.total_results != null && (
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">
          {data.total_results.toLocaleString()} result{data.total_results !== 1 ? 's' : ''} on TMDB
        </p>
      )}

      {/* No results */}
      {!searching && query.trim().length > 1 && results.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400">No results for "{query}"</p>
      )}

      {/* Empty prompt */}
      {query.trim().length <= 1 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 dark:text-slate-600">
          <Film className="w-14 h-14 text-slate-800" />
          <p className="text-sm">Type a movie title to search TMDB</p>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {results.map((movie) => {
          const libId = addedIds.get(movie.tmdb_id)
          const isAdded = libId != null
          const isAdding = addMutation.isPending && addMutation.variables === movie.tmdb_id

          return (
            <div
              key={movie.tmdb_id}
              className="flex gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-slate-300 dark:border-slate-700 transition-all"
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
                  <div className="w-10 h-[60px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                    <Film className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-slate-100 truncate">{movie.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      {formatYear(movie.release_date)}
                      {movie.rating && movie.rating > 0 ? ` · ★ ${movie.rating.toFixed(1)}` : ''}
                    </p>
                  </div>

                  {/* Action */}
                  {isAdded ? (
                    <button
                      onClick={() => navigate(`/movies/${libId}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-800/40 hover:bg-green-800/60 text-green-400 text-xs font-medium rounded-lg flex-shrink-0 transition-colors"
                    >
                      <CheckCircle size={13} /> In Library
                    </button>
                  ) : (
                    <button
                      onClick={() => addMutation.mutate(movie.tmdb_id)}
                      disabled={isAdding}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex-shrink-0 transition-colors"
                    >
                      {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      Add
                    </button>
                  )}
                </div>

                {movie.overview && (
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-2">{movie.overview}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
