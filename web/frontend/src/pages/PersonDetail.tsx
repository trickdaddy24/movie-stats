import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Loader2, ExternalLink } from 'lucide-react'
import { getPerson } from '../lib/api'
import { formatYear } from '../lib/utils'
import type { FilmographyCredit, PersonDetail as PersonDetailType } from '../lib/api'

export default function PersonDetail() {
  const { tmdbPersonId } = useParams<{ tmdbPersonId: string }>()
  const navigate = useNavigate()
  const personId = parseInt(tmdbPersonId!, 10)
  const [tab, setTab] = useState<'cast' | 'crew'>('cast')
  const [showFullBio, setShowFullBio] = useState(false)

  const { data: person, isLoading, isError } = useQuery({
    queryKey: ['person', personId],
    queryFn: () => getPerson(personId),
    enabled: !isNaN(personId),
  })

  // Switch default tab based on known_for_department
  useEffect(() => {
    if (person?.known_for_department && person.known_for_department !== 'Acting') {
      setTab('crew')
    }
  }, [person?.known_for_department])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (isError || !person) {
    return (
      <div className="flex-1 bg-slate-950 p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-brand-600 hover:text-brand-500 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <p className="text-slate-600 dark:text-slate-400">Person not found</p>
      </div>
    )
  }

  const activeCredits = tab === 'cast' ? person.cast_credits : person.crew_credits
  const bioTruncated = (person.biography || '').length > 400

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero Section */}
      <div className="border-b border-slate-800 px-6 pt-4 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-brand-600 hover:text-brand-500 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex gap-8 mt-6">
          {/* Profile Photo */}
          {person.profile_url ? (
            <img
              src={person.profile_url}
              alt={person.name}
              className="w-48 flex-shrink-0 rounded-xl shadow-2xl border border-slate-700 object-cover"
            />
          ) : (
            <div className="w-48 h-auto flex-shrink-0 rounded-xl shadow-2xl border border-slate-700 bg-slate-800 flex items-center justify-center">
              <span className="text-6xl font-bold text-slate-600">
                {person.name
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </span>
            </div>
          )}

          {/* Info Column */}
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white">{person.name}</h1>

            {person.known_for_department && (
              <p className="text-brand-400 mt-1 text-sm font-medium">{person.known_for_department}</p>
            )}

            {/* Birthday / Deathday / Birthplace */}
            <div className="text-sm text-slate-400 mt-3 space-y-1">
              {person.birthday && (
                <p>
                  <span className="font-semibold">Born:</span> {person.birthday}
                  {person.deathday && ` – ${person.deathday}`}
                </p>
              )}
              {person.place_of_birth && (
                <p>
                  <span className="font-semibold">Birthplace:</span> {person.place_of_birth}
                </p>
              )}
            </div>

            {/* Biography */}
            {person.biography && (
              <div className="mt-4">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {showFullBio || !bioTruncated ? person.biography : person.biography.substring(0, 400) + '…'}
                </p>
                {bioTruncated && (
                  <button
                    onClick={() => setShowFullBio(!showFullBio)}
                    className="text-xs text-brand-400 hover:text-brand-300 mt-2 font-semibold transition-colors"
                  >
                    {showFullBio ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {/* IMDb Link */}
            {person.imdb_id && (
              <a
                href={`https://www.imdb.com/name/${person.imdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-semibold rounded transition-colors"
              >
                IMDb
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Filmography Section */}
      <div className="px-6 py-12">
        <h2 className="text-2xl font-bold text-white mb-6">Filmography</h2>

        {/* Tabs */}
        {(person.cast_credits.length > 0 || person.crew_credits.length > 0) && (
          <div className="flex gap-2 mb-6 border-b border-slate-800">
            {person.cast_credits.length > 0 && (
              <button
                onClick={() => setTab('cast')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'cast'
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                As Actor ({person.cast_credits.length})
              </button>
            )}
            {person.crew_credits.length > 0 && (
              <button
                onClick={() => setTab('crew')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'crew'
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                As Crew ({person.crew_credits.length})
              </button>
            )}
          </div>
        )}

        {/* Filmography Grid */}
        {activeCredits.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {activeCredits.map((credit, i) => (
              <FilmographyCard key={`${credit.tmdb_id}-${credit.job ?? 'cast'}-${i}`} credit={credit} tab={tab} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-500">
              No {tab === 'cast' ? 'acting' : 'crew'} credits found.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function FilmographyCard({ credit, tab }: { credit: FilmographyCredit; tab: 'cast' | 'crew' }) {
  const subtitle = tab === 'cast' ? credit.character : credit.job
  const year = formatYear(credit.release_date)

  const cardContent = (
    <div className="group bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all">
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {credit.poster_url ? (
          <img
            src={credit.poster_url}
            alt={credit.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <span className="text-xs text-center px-2">{credit.title}</span>
          </div>
        )}

        {/* Rating Badge */}
        {credit.rating != null && credit.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 rounded-md px-1.5 py-0.5">
            <span className="text-xs font-semibold text-yellow-400">{credit.rating.toFixed(1)}</span>
          </div>
        )}

        {/* In Library Badge */}
        {credit.in_library && (
          <div className="absolute top-2 left-2 bg-green-500/90 text-white text-xs font-semibold px-2 py-1 rounded">
            IN LIBRARY
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <h3 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-2">
          {credit.title}
        </h3>
        {year && (
          <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">{year}</p>
        )}
        {subtitle && (
          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">{subtitle}</p>
        )}
      </div>
    </div>
  )

  if (credit.in_library && credit.library_id) {
    return (
      <Link to={`/movies/${credit.library_id}`} className="hover:no-underline">
        {cardContent}
      </Link>
    )
  }
  return cardContent
}
