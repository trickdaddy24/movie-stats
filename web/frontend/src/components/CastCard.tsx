import type { CastCrewMember } from '../lib/api'

interface Props {
  person: CastCrewMember
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const AVATAR_COLORS = [
  'bg-indigo-700',
  'bg-violet-700',
  'bg-blue-700',
  'bg-teal-700',
  'bg-rose-700',
  'bg-orange-700',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function CastCard({ person }: Props) {
  const label = person.role === 'cast' ? person.character_name : person.job
  const hasPhoto = !!person.profile_path

  return (
    <div className="flex-shrink-0 w-28 text-center">
      {/* Avatar */}
      <div className="mx-auto w-20 h-20 rounded-full overflow-hidden border-2 border-slate-300 dark:border-slate-700 mb-2">
        {hasPhoto ? (
          <img
            src={person.profile_path}
            alt={person.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.parentElement!.classList.add(avatarColor(person.name || ''), 'flex', 'items-center', 'justify-center')
              const span = document.createElement('span')
              span.className = 'text-sm font-bold text-white'
              span.textContent = getInitials(person.name || '')
              target.parentElement!.appendChild(span)
            }}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${avatarColor(person.name || '')}`}
          >
            <span className="text-sm font-bold text-white">{getInitials(person.name || '')}</span>
          </div>
        )}
      </div>

      <p className="text-xs font-semibold text-slate-200 leading-tight line-clamp-2">
        {person.name}
      </p>
      {label && (
        <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-2">{label}</p>
      )}
    </div>
  )
}
