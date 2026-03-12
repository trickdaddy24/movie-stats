import { useQuery } from '@tanstack/react-query'
import { Film, Clock, Star, Timer, Loader2, Server } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getStats, StatsData } from '../lib/api'

export default function Stats() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 5 * 60 * 1000, // 5 min cache
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Failed to load stats</p>
      </div>
    )
  }

  const { overview, genres, decades, rating_distribution, content_ratings, added_over_time, top_rated } = stats

  if (overview.total_movies === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <Film className="w-16 h-16 text-slate-300 dark:text-slate-600" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">No movies yet</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add some movies to your library to see stats and insights
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Total Movies */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Movies</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.total_movies}</p>
              </div>
              <Film className="w-8 h-8 text-brand-500 opacity-50" />
            </div>
          </div>

          {/* Total Hours */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Watch Time</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.total_hours}</p>
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

          {/* Avg Runtime */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Runtime</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {overview.avg_runtime || 'N/A'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">min</p>
              </div>
              <Timer className="w-8 h-8 text-brand-500 opacity-50" />
            </div>
          </div>

          {/* Plex Movies */}
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

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Genres */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Top Genres</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={genres}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <XAxis type="number" stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="currentColor"
                  className="text-slate-500 dark:text-slate-400"
                  width={115}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#1e293b' }}
                />
                <Bar dataKey="count" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rating Distribution */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Rating Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rating_distribution} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <XAxis
                  dataKey="bucket"
                  stroke="currentColor"
                  className="text-slate-500 dark:text-slate-400"
                />
                <YAxis stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#1e293b' }}
                />
                <Bar dataKey="count" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Decade */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Movies by Decade</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={decades} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <XAxis
                  dataKey="decade"
                  stroke="currentColor"
                  className="text-slate-500 dark:text-slate-400"
                />
                <YAxis stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#1e293b' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Content Ratings */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Content Ratings</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={content_ratings} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <XAxis
                  dataKey="rating"
                  stroke="currentColor"
                  className="text-slate-500 dark:text-slate-400"
                />
                <YAxis stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#1e293b' }}
                />
                <Bar dataKey="count" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Added Over Time */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Movies Added Over Time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={added_over_time} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-700"
              />
              <XAxis
                dataKey="month"
                stroke="currentColor"
                className="text-slate-500 dark:text-slate-400"
              />
              <YAxis stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#1e293b' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#4f46e5"
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Rated */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Top Rated Movies</h3>
          <div className="space-y-3">
            {top_rated.map((movie, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">
                    {movie.runtime} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
