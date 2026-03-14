import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Film, Clock, Star, Server, Loader2, Plus, Activity } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getStats, getUpcoming, getLists, addMovie, getRadarrSyncEvents, type RadarrSyncEvent } from '../lib/api'
import { formatYear } from '../lib/utils'

export default function Dashboard() {
  const { auth } = useAuth()
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 5 * 60 * 1000,
  })
  const { data: upcomingData, isLoading: moviesLoading } = useQuery({
    queryKey: ['upcoming'],
    queryFn: () => getUpcoming(1),
    staleTime: 5 * 60 * 1000,
  })
  const { data: syncEvents } = useQuery({
    queryKey: ['radarr-sync-events'],
    queryFn: () => getRadarrSyncEvents(5),
    staleTime: 60 * 1000,
  })
  const qc = useQueryClient()
  const addMutation = useMutation({
    mutationFn: (tmdbId: number) => addMovie(tmdbId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movies'] })
      qc.invalidateQueries({ queryKey: ['lists'] })
    },
  })
  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
  })

  const isLoading = statsLoading || moviesLoading || listsLoading

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Failed to load dashboard</p>
      </div>
    )
  }

  const upcomingMovies = upcomingData?.results?.slice(0, 6) || []
  const overview = stats.overview
  const topRated = stats.top_rated || []

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const favoritesList = lists?.find((l) => l.list_type === 'favorites')
  const watchlistList = lists?.find((l) => l.list_type === 'watchlist')
  const customLists = lists?.filter((l) => l.list_type === 'custom') || []

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Welcome back, {auth.user?.username}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{today}</p>
        </div>

        {/* Overview stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Movies */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Movies</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {overview.total_movies}
                </p>
              </div>
              <Film className="w-8 h-8 text-brand-500 opacity-50" />
            </div>
          </div>

          {/* Watch Time */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Watch Time</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {overview.total_hours}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">hours</p>
              </div>
              <Clock className="w-8 h-8 text-brand-500 opacity-50" />
            </div>
          </div>

          {/* Avg Rating */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Rating</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {overview.avg_rating ? overview.avg_rating.toFixed(1) : 'N/A'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">/10</p>
              </div>
              <Star className="w-8 h-8 text-brand-500 opacity-50" />
            </div>
          </div>

          {/* Plex Count */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">From Plex</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.plex_count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {overview.manual_count} manual
                </p>
              </div>
              <Server className="w-8 h-8 text-brand-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Upcoming Movies */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming</h2>
            <Link
              to="/search"
              className="text-sm text-brand-500 hover:text-brand-400 transition-colors"
            >
              View all →
            </Link>
          </div>
          {upcomingMovies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 justify-items-start">
              {upcomingMovies.map((movie) => (
                <UpcomingMovieCard
                  key={movie.tmdb_id}
                  movie={movie}
                  onAdd={() => addMutation.mutate(movie.tmdb_id)}
                  isAdding={addMutation.isPending && addMutation.variables === movie.tmdb_id}
                />
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No upcoming movies</p>
          )}
        </section>

        {/* Your Lists */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Lists</h2>
            <Link
              to="/lists"
              className="text-sm text-brand-500 hover:text-brand-400 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {favoritesList && (
              <ListCard
                emoji="❤️"
                name="Favorites"
                count={favoritesList.movie_count}
                listId={favoritesList.id}
              />
            )}
            {watchlistList && (
              <ListCard
                emoji="🎬"
                name="Watchlist"
                count={watchlistList.movie_count}
                listId={watchlistList.id}
              />
            )}
            {customLists.map((list) => (
              <ListCard
                key={list.id}
                emoji="📋"
                name={list.name}
                count={list.movie_count}
                listId={list.id}
              />
            ))}
          </div>
        </section>

        {/* Top Rated */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top Rated</h2>
          {topRated.length > 0 ? (
            <div className="space-y-2">
              {topRated.slice(0, 5).map((movie, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {movie.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {movie.rating.toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{movie.release_date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No rated movies yet</p>
          )}
        </section>

        {/* Radarr Sync Activity */}
        {syncEvents && syncEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-brand-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Radarr Sync Activity</h2>
            </div>
            <div className="space-y-2">
              {syncEvents.map((event) => (
                <SyncEventRow key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function SyncEventRow({ event }: { event: RadarrSyncEvent }) {
  const getEventLabel = (eventType: string, isUpgrade: number) => {
    switch (eventType) {
      case 'MovieAdded': return { label: 'Added to Radarr', color: 'bg-green-900/50', dot: 'bg-green-400' }
      case 'Download': return { label: isUpgrade ? 'Quality Upgrade' : 'Downloaded', color: 'bg-blue-900/50', dot: 'bg-blue-400' }
      case 'MovieDelete': return { label: 'Removed from Radarr', color: 'bg-red-900/50', dot: 'bg-red-400' }
      case 'Grab': return { label: 'Grabbed (pending)', color: 'bg-yellow-900/50', dot: 'bg-yellow-400' }
      case 'Rename': return { label: 'File renamed', color: 'bg-slate-700/50', dot: 'bg-slate-400' }
      case 'Test': return { label: 'Webhook test', color: 'bg-slate-700/50', dot: 'bg-slate-400' }
      default: return { label: eventType, color: 'bg-slate-700/50', dot: 'bg-slate-400' }
    }
  }

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const eventInfo = getEventLabel(event.event_type, event.is_upgrade)

  return (
    <div className="flex items-center gap-3 p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${eventInfo.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{event.title || 'Unknown'}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{eventInfo.label}</p>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{formatRelativeTime(event.occurred_at)}</p>
    </div>
  )
}

function UpcomingMovieCard({
  movie,
  onAdd,
  isAdding,
}: {
  movie: any
  onAdd: () => void
  isAdding: boolean
}) {
  return (
    <div className="group cursor-pointer bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5">
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600">
            <Film className="w-12 h-12" />
            <span className="text-xs text-center px-2">{movie.title}</span>
          </div>
        )}

        {/* Rating badge */}
        {movie.rating != null && movie.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-semibold text-white">{movie.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Add button overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAdd()
            }}
            disabled={isAdding}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm text-slate-100 line-clamp-2 leading-snug">{movie.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-500">{formatYear(movie.release_date)}</p>
      </div>
    </div>
  )
}

function ListCard({
  emoji,
  name,
  count,
  listId,
}: {
  emoji: string
  name: string
  count: number
  listId: number
}) {
  return (
    <Link
      to={`/lists/${listId}`}
      className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-colors cursor-pointer"
    >
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{name}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {count} movie{count !== 1 ? 's' : ''}
      </p>
    </Link>
  )
}
