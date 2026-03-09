import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search as SearchIcon, Plus, Check, Loader2, Star, X } from 'lucide-react'
import { searchTMDB, addMovie, getTMDBMovie, getMovies } from '../lib/api'
import { formatYear } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

export default function Search() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedTmdbId, setSelectedTmdbId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const [addingId, setAddingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: libraryData } = useQuery({
    queryKey: ['movies', '', '', 1],
    queryFn: () => getMovies({ page: 1, page_size: 100 }),
  })

  const libraryTmdbIds = new Set(libraryData?.movies.map((m) => m.tmdb_id) ?? [])

  const { data: searchResults, isLoading: searching, isError } = useQuery({
    queryKey: ['tmdb-search', submittedQuery, page],
    queryFn: () => searchTMDB(submittedQuery, page),
    enabled: submittedQuery.length > 0,
  })

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['tmdb-preview', selectedTmdbId],
    queryFn: () => getTMDBMovie(selectedTmdbId!),
    enabled: selectedTmdbId !== null,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSubmittedQuery(query.trim())
    setPage(1)
    setSelectedTmdbId(null)
  }

  async function handleAdd(tmdbId: number) {
    setAddingId(tmdbId)
    try {
      const result = await addMovie(tmdbId)
      setAddedIds((prev) => new Set([...prev, tmdbId]))
      qc.invalidateQueries({ queryKey: ['movies'] })
      if (selectedTmdbId === tmdbId) {
        navigate(`/movies/${result.id}`)
      }
    } catch (err) {
      console.error('Failed to add movie', err)
    } finally {
      setAddingId(null)
    }
  }

  function isInLibrary(tmdbId: number) {
    return libraryTmdbIds.has(tmdbId) || addedIds.has(tmdbId)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Search Movies</h1>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search TMDB for movies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
          Search
        </button>
      </form>

      <div className="flex gap-6">
        {/* Results list */}
        <div className="flex-1 min-w-0">
          {!submittedQuery && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-2">
              <SearchIcon className="w-14 h-14 text-slate-800" />
              <p className="text-base">Search TMDB to find movies</p>
            </div>
          )}

          {isError && (
            <p className="text-red-400 text-sm">Search failed. Check your TMDB API key.</p>
          )}

          {searchResults && (
            <>
              <p className="text-xs text-slate-500 mb-3">
                {searchResults.total_results.toLocaleString()} results for "{submittedQuery}"
              </p>
              <div className="space-y-2">
                {searchResults.results.map((movie) => {
                  const inLib = isInLibrary(movie.tmdb_id)
                  const isAdding = addingId === movie.tmdb_id
                  const isSelected = selectedTmdbId === movie.tmdb_id

                  return (
                    <div
                      key={movie.tmdb_id}
                      onClick={() => setSelectedTmdbId(isSelected ? null : movie.tmdb_id)}
                      className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800 border-brand-500'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Poster thumbnail */}
                      <div className="flex-shrink-0 w-12 h-18">
                        {movie.poster_url ? (
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            className="w-12 h-[72px] object-cover rounded-lg"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-[72px] bg-slate-700 rounded-lg flex items-center justify-center">
                            <SearchIcon className="w-4 h-4 text-slate-500" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm text-slate-100 truncate">{movie.title}</h3>
                            <p className="text-xs text-slate-500">{formatYear(movie.release_date)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {movie.rating != null && movie.rating > 0 && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                {movie.rating.toFixed(1)}
                              </span>
                            )}
                            {inLib ? (
                              <span className="flex items-center gap-1 px-2 py-1 bg-green-900/40 text-green-400 text-xs rounded-lg border border-green-800">
                                <Check className="w-3 h-3" />
                                In Library
                              </span>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAdd(movie.tmdb_id) }}
                                disabled={isAdding}
                                className="flex items-center gap-1 px-2 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-xs rounded-lg transition-colors"
                              >
                                {isAdding ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Plus className="w-3 h-3" />
                                )}
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                        {movie.overview && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{movie.overview}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {searchResults.total_pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-slate-400">
                    {page} / {Math.min(searchResults.total_pages, 500)}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(searchResults.total_pages, p + 1))}
                    disabled={page >= searchResults.total_pages}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Preview panel */}
        {selectedTmdbId && (
          <div className="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden self-start sticky top-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-sm font-semibold text-slate-200">Preview</span>
              <button
                onClick={() => setSelectedTmdbId(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {previewLoading && (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            )}

            {preview && !previewLoading && (
              <div className="p-4">
                {preview.poster_url && (
                  <img
                    src={preview.poster_url}
                    alt={preview.title}
                    className="w-full rounded-lg mb-3 object-cover"
                  />
                )}
                <h3 className="font-bold text-white">{preview.title}</h3>
                {preview.tagline && (
                  <p className="text-xs text-slate-400 italic mt-0.5">{preview.tagline}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {preview.genres?.map((g: string) => (
                    <span key={g} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                      {g}
                    </span>
                  ))}
                </div>
                {preview.overview && (
                  <p className="text-xs text-slate-400 mt-3 line-clamp-4">{preview.overview}</p>
                )}
                <div className="mt-4">
                  {isInLibrary(selectedTmdbId) ? (
                    <button
                      onClick={() => {
                        const libMovie = libraryData?.movies.find(m => m.tmdb_id === selectedTmdbId)
                        if (libMovie) navigate(`/movies/${libMovie.id}`)
                      }}
                      className="w-full py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      View in Library
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAdd(selectedTmdbId)}
                      disabled={addingId === selectedTmdbId}
                      className="w-full py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {addingId === selectedTmdbId ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                      ) : (
                        <><Plus className="w-4 h-4" /> Add to Library</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
