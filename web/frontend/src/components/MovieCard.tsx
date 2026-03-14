import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Star, Heart, Bookmark, Plus, Loader2 } from 'lucide-react'
import type { Movie } from '../lib/api'
import { formatYear } from '../lib/utils'
import { getLists, addToList, removeFromList, getMovieLists } from '../lib/api'

interface Props {
  movie: Movie
}

export default function MovieCard({ movie }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lists, setLists] = useState<{ id: number; list_type: string }[]>([])
  const [favId, setFavId] = useState<number | null>(null)
  const [watchlistId, setWatchlistId] = useState<number | null>(null)
  const [inFav, setInFav] = useState(false)
  const [inWatch, setInWatch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [customLists, setCustomLists] = useState<{ id: number; name: string }[]>([])
  const [movieListIds, setMovieListIds] = useState<number[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const l = await getLists()
        const fav = l.find((x) => x.list_type === 'favorites')
        const watch = l.find((x) => x.list_type === 'watchlist')
        if (fav) setFavId(fav.id)
        if (watch) setWatchlistId(watch.id)
        setLists(l)
        setCustomLists(l.filter((x) => x.list_type === 'custom').map((x) => ({ id: x.id, name: x.name })))
      } catch (err) {
        console.error('Failed to load lists:', err)
      }
    })()
  }, [])

  useEffect(() => {
    if (!favId || !watchlistId) return
    ;(async () => {
      try {
        const result = await getMovieLists(movie.id)
        setInFav(result.list_ids.includes(favId))
        setInWatch(result.list_ids.includes(watchlistId))
        setMovieListIds(result.list_ids)
      } catch (err) {
        console.error('Failed to check lists:', err)
      }
    })()
  }, [favId, watchlistId, movie.id])

  async function handleAddFavorite(e: React.MouseEvent) {
    e.stopPropagation()
    if (!favId) return
    setLoading(true)
    try {
      if (inFav) {
        await removeFromList(favId, movie.id)
        setInFav(false)
      } else {
        await addToList(favId, movie.id)
        setInFav(true)
      }
      queryClient.invalidateQueries({ queryKey: ['movies'] })
    } finally {
      setLoading(false)
    }
  }

  async function handleAddWatchlist(e: React.MouseEvent) {
    e.stopPropagation()
    if (!watchlistId) return
    setLoading(true)
    try {
      if (inWatch) {
        await removeFromList(watchlistId, movie.id)
        setInWatch(false)
      } else {
        await addToList(watchlistId, movie.id)
        setInWatch(true)
      }
      queryClient.invalidateQueries({ queryKey: ['movies'] })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleCustomList(listId: number) {
    setLoading(true)
    try {
      if (movieListIds.includes(listId)) {
        await removeFromList(listId, movie.id)
        setMovieListIds(movieListIds.filter((id) => id !== listId))
      } else {
        await addToList(listId, movie.id)
        setMovieListIds([...movieListIds, listId])
      }
      queryClient.invalidateQueries({ queryKey: ['movies'] })
    } finally {
      setLoading(false)
    }
  }

  const poster =
    movie.poster_url ||
    (movie.artwork?.find((a) => a.type === 'poster')?.url) ||
    ''

  return (
    <div
      onClick={() => navigate(`/movies/${movie.id}`)}
      className="group cursor-pointer bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <span className="text-xs text-center px-2">{movie.title}</span>
          </div>
        )}

        {/* Plex badge */}
        {movie.source === 'plex' && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#e5a00d]/90 text-black text-[10px] font-bold rounded">
            PLEX
          </span>
        )}

        {/* Rating badge */}
        {movie.rating != null && movie.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold text-white">{movie.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Content rating badge */}
        {movie.content_rating && (
          <span className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 border border-slate-500 text-slate-200 text-[10px] font-bold rounded">
            {movie.content_rating}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <h3 className="font-semibold text-sm text-slate-100 line-clamp-2 leading-snug">
            {movie.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{formatYear(movie.release_date)}</p>
        </div>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {movie.genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 dark:text-slate-400 rounded-md border border-slate-300 dark:border-slate-700"
              >
                {g}
              </span>
            ))}
            {movie.genres.length > 2 && (
              <span className="text-[10px] px-1.5 py-0.5 text-slate-400 dark:text-slate-600">
                +{movie.genres.length - 2}
              </span>
            )}
          </div>
        )}

        {/* List buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAddFavorite}
            disabled={loading || !favId}
            title={inFav ? 'Remove from Favorites' : 'Add to Favorites'}
            className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded transition-colors ${
              inFav
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
            } disabled:opacity-50`}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3" />}
          </button>
          <button
            onClick={handleAddWatchlist}
            disabled={loading || !watchlistId}
            title={inWatch ? 'Remove from Watchlist' : 'Add to Watchlist'}
            className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded transition-colors ${
              inWatch
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
            } disabled:opacity-50`}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3" />}
          </button>

          {/* Custom lists dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              disabled={loading || customLists.length === 0}
              title="Add to custom lists"
              className="px-2 py-1.5 rounded text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              <Plus className="w-3 h-3" />
            </button>

            {showMenu && customLists.length > 0 && (
              <div className="absolute bottom-full mb-2 right-0 bg-slate-800 dark:bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 min-w-48">
                {customLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleCustomList(list.id)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
                  >
                    <input
                      type="checkbox"
                      checked={movieListIds.includes(list.id)}
                      onChange={() => {}}
                      className="w-4 h-4"
                    />
                    <span className="flex-1">{list.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
