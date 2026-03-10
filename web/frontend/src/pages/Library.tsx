import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Film, ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react'
import { getMovies, refreshAllArtwork } from '../lib/api'
import MovieCard from '../components/MovieCard'
import { useNavigate } from 'react-router-dom'

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Science Fiction',
  'Thriller', 'War', 'Western',
]

export default function Library() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [genre, setGenre] = useState('')
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  async function handleRefreshAllArtwork() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const result = await refreshAllArtwork()
      if (!result.started) {
        setRefreshMsg('All movies already have poster art.')
      } else {
        setRefreshMsg(`Fetching posters for ${result.movies_missing_poster} movies in the background…`)
        // Refresh library after a delay to pick up newly stored posters
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['movies'] })
          setRefreshMsg(null)
        }, 8000)
      }
    } catch {
      setRefreshMsg('Failed to start artwork refresh.')
    } finally {
      setRefreshing(false)
    }
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['movies', search, genre, page],
    queryFn: () => getMovies({ search: search || undefined, genre: genre || undefined, page }),
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handleGenreChange(g: string) {
    setGenre(g)
    setPage(1)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Library</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              {data.total} {data.total === 1 ? 'movie' : 'movies'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAllArtwork}
            disabled={refreshing}
            title="Re-fetch posters from TMDB and fanart.tv for movies missing artwork"
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            Refresh Posters
          </button>
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" />
            Add Movies
          </button>
        </div>
      </div>

      {refreshMsg && (
        <p className="mb-4 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          {refreshMsg}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm rounded-lg transition-colors"
          >
            Search
          </button>
          {(search || searchInput) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
              className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        <select
          value={genre}
          onChange={(e) => handleGenreChange(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-brand-500 transition-colors"
        >
          <option value="">All Genres</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <p className="text-lg">Failed to load library</p>
          <p className="text-sm mt-1">Make sure the backend is running on port 8899</p>
        </div>
      )}

      {!isLoading && !isError && data?.movies.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
          <Film className="w-16 h-16 text-slate-700" />
          <p className="text-lg font-medium">No movies yet</p>
          <p className="text-sm">Search to add one</p>
          <button
            onClick={() => navigate('/search')}
            className="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
          >
            Go to Search
          </button>
        </div>
      )}

      {!isLoading && !isError && data && data.movies.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {data.movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-sm rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-sm text-slate-400">
                Page {page} of {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-sm rounded-lg transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
