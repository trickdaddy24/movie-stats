import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { Movie } from '../lib/api'
import { formatYear } from '../lib/utils'

interface Props {
  movie: Movie
}

export default function MovieCard({ movie }: Props) {
  const navigate = useNavigate()

  const poster =
    movie.poster_url ||
    (movie.artwork?.find((a) => a.type === 'poster')?.url) ||
    ''

  return (
    <div
      onClick={() => navigate(`/movies/${movie.id}`)}
      className="group cursor-pointer bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-brand-500 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/10 hover:-translate-y-0.5"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-slate-800 overflow-hidden">
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
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-600">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
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
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-slate-100 line-clamp-2 leading-snug">
          {movie.title}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{formatYear(movie.release_date)}</p>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {movie.genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md border border-slate-700"
              >
                {g}
              </span>
            ))}
            {movie.genres.length > 2 && (
              <span className="text-[10px] px-1.5 py-0.5 text-slate-600">
                +{movie.genres.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
