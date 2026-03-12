import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Star, Clock, Calendar, Trash2, RefreshCw, ExternalLink, Loader2, X
} from 'lucide-react'
import { getMovie, deleteMovie, refreshArtwork } from '../lib/api'
import type { ArtworkItem } from '../lib/api'
import CastCard from '../components/CastCard'
import { formatDate, formatRuntime, getRating } from '../lib/utils'

type ArtTab = 'posters' | 'backdrops' | 'logos'

export default function MovieDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const movieId = parseInt(id!, 10)

  const [artTab, setArtTab] = useState<ArtTab>('posters')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const { data: movie, isLoading, isError } = useQuery({
    queryKey: ['movie', movieId],
    queryFn: () => getMovie(movieId),
    enabled: !isNaN(movieId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteMovie(movieId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movies'] })
      navigate('/library')
    },
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshArtwork(movieId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movie', movieId] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (isError || !movie) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 text-slate-500">
        <p className="text-lg">Movie not found</p>
        <button onClick={() => navigate('/library')} className="text-brand-500 hover:text-brand-400 text-sm">
          Back to Library
        </button>
      </div>
    )
  }

  const artwork = movie.artwork ?? []
  const posters = artwork.filter((a) => a.type === 'poster')
  const backdrops = artwork.filter((a) => a.type === 'backdrop')
  const logos = artwork.filter((a) => a.type === 'logo')

  const primaryBackdrop = backdrops[0]?.url || ''
  const primaryPoster = posters[0]?.url || ''

  const directors = (movie.crew ?? []).filter((p) => p.job === 'Director')
  const writers = (movie.crew ?? []).filter(
    (p) => p.job === 'Screenplay' || p.job === 'Writer' || p.job === 'Story'
  )

  const artTabItems: Record<ArtTab, ArtworkItem[]> = {
    posters,
    backdrops,
    logos,
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size artwork"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Hero */}
      <div className="relative">
        {/* Backdrop */}
        {primaryBackdrop && (
          <div className="absolute inset-0 h-[480px] overflow-hidden">
            <img
              src={primaryBackdrop}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
          </div>
        )}

        <div className={`relative px-6 pt-4 ${primaryBackdrop ? 'pb-8' : 'pb-6'}`}>
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-sm transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className={`flex gap-8 ${primaryBackdrop ? 'min-h-[380px]' : ''}`}>
            {/* Poster */}
            {primaryPoster && (
              <div className="flex-shrink-0">
                <img
                  src={primaryPoster}
                  alt={movie.title}
                  className="w-48 rounded-xl shadow-2xl border border-slate-700 cursor-pointer"
                  onClick={() => setLightboxUrl(primaryPoster)}
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 flex flex-col justify-end pb-2">
              <h1 className="text-4xl font-bold text-white leading-tight">{movie.title}</h1>

              {movie.tagline && (
                <p className="text-slate-400 italic mt-2">{movie.tagline}</p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 mt-4">
                {movie.rating != null && movie.rating > 0 && (
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold">{getRating(movie.rating)}</span>
                    {movie.vote_count != null && (
                      <span className="text-slate-500 text-sm">({movie.vote_count.toLocaleString()} votes)</span>
                    )}
                  </span>
                )}

                {movie.runtime != null && movie.runtime > 0 && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-4 h-4" />
                    {formatRuntime(movie.runtime)}
                  </span>
                )}

                {movie.release_date && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    {formatDate(movie.release_date)}
                  </span>
                )}

                {movie.content_rating && (
                  <span className="px-2 py-0.5 border border-slate-500 text-slate-300 text-xs font-bold rounded">
                    {movie.content_rating}
                  </span>
                )}
              </div>

              {/* Genres */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {movie.genres.map((g) => (
                    <span
                      key={g}
                      className="px-3 py-1 bg-brand-600/20 text-brand-500 border border-brand-600/30 rounded-full text-xs font-medium"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Plex availability */}
              {movie.source === 'plex' && movie.plex_library && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-1 bg-[#e5a00d]/20 border border-[#e5a00d]/40 text-[#e5a00d] text-xs font-semibold rounded">
                    PLEX
                  </span>
                  <span className="text-slate-400 text-sm">Available in <span className="text-slate-200">{movie.plex_library}</span></span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg border border-slate-700 transition-colors"
                >
                  {refreshMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Refresh Artwork
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove "${movie.title}" from your library?`)) {
                      deleteMutation.mutate()
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-800/50 text-red-400 text-sm rounded-lg border border-red-800/50 transition-colors"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Remove from Library
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 pb-12 space-y-10">
        {/* Overview */}
        {movie.overview && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Overview</h2>
            <p className="text-slate-300 leading-relaxed max-w-4xl">{movie.overview}</p>
          </section>
        )}

        {/* Artwork tabs */}
        {(posters.length > 0 || backdrops.length > 0 || logos.length > 0) && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Artwork</h2>
            <div className="flex gap-2 mb-4">
              {(['posters', 'backdrops', 'logos'] as ArtTab[]).map((tab) => {
                const count = artTabItems[tab].length
                return count > 0 ? (
                  <button
                    key={tab}
                    onClick={() => setArtTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                      artTab === tab
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {tab} ({count})
                  </button>
                ) : null
              })}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3">
              {artTabItems[artTab].map((art, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border border-slate-800 hover:border-brand-500 transition-colors"
                  onClick={() => setLightboxUrl(art.url)}
                >
                  <img
                    src={art.url}
                    alt={`${artTab} ${i + 1}`}
                    className={`object-cover hover:scale-105 transition-transform ${
                      artTab === 'posters'
                        ? 'w-32 h-48'
                        : artTab === 'backdrops'
                        ? 'w-64 h-36'
                        : 'w-48 h-24 object-contain bg-slate-900 p-2'
                    }`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cast */}
        {movie.cast && movie.cast.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {movie.cast.slice(0, 20).map((person, i) => (
                <CastCard key={i} person={person} />
              ))}
            </div>
          </section>
        )}

        {/* Crew */}
        {(directors.length > 0 || writers.length > 0) && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Crew</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {directors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {directors.length === 1 ? 'Director' : 'Directors'}
                  </p>
                  {directors.map((p, i) => (
                    <p key={i} className="text-slate-200 text-sm">{p.name}</p>
                  ))}
                </div>
              )}
              {writers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Writers</p>
                  {writers.map((p, i) => (
                    <p key={i} className="text-slate-200 text-sm">
                      {p.name}
                      {p.job && p.job !== 'Writer' && (
                        <span className="text-slate-500 text-xs ml-1">({p.job})</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* External IDs */}
        {(movie.tmdb_id || movie.imdb_id || (movie.external_ids && movie.external_ids.length > 0)) && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">External IDs</h2>
            <div className="flex flex-wrap gap-3">
              <ExternalIdBadge label="TMDB" value={String(movie.tmdb_id)} url={`https://www.themoviedb.org/movie/${movie.tmdb_id}`} />
              {movie.imdb_id && (
                <ExternalIdBadge label="IMDb" value={movie.imdb_id} url={`https://www.imdb.com/title/${movie.imdb_id}`} />
              )}
              {movie.external_ids
                ?.filter((e) => e.source !== 'tmdb' && e.source !== 'imdb')
                .map((e, i) => (
                  <ExternalIdBadge key={i} label={e.source} value={e.external_id} url={externalIdUrl(e.source, e.external_id)} />
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function externalIdUrl(source: string, id: string): string | undefined {
  switch (source) {
    case 'wikidata':  return `https://www.wikidata.org/wiki/${id}`
    case 'facebook':  return `https://www.facebook.com/${id}`
    case 'instagram': return `https://www.instagram.com/${id}`
    case 'twitter':   return `https://twitter.com/${id}`
    default:          return undefined
  }
}

function ExternalIdBadge({
  label,
  value,
  url,
}: {
  label: string
  value: string
  url?: string
}) {
  const content = (
    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm">
      <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">{label}</span>
      <span className="text-slate-300">{value}</span>
      {url && <ExternalLink className="w-3 h-3 text-slate-500" />}
    </span>
  )

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:border-brand-500 transition-colors rounded-lg">
        {content}
      </a>
    )
  }
  return content
}
