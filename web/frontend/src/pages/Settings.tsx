import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, EyeOff, Save, ExternalLink } from 'lucide-react'
import { getKeyStatus, updateKeys, type KeyStatus } from '../lib/api'

export default function Settings() {
  const qc = useQueryClient()
  const { data: keys, isLoading } = useQuery({
    queryKey: ['settings-keys'],
    queryFn: getKeyStatus,
  })

  const saveMut = useMutation({
    mutationFn: updateKeys,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-keys'] }),
  })

  if (isLoading) return <div className="p-6 text-slate-500 dark:text-slate-500 dark:text-slate-400">Loading…</div>

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white
">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400 mt-1">Configure API keys for TMDB, fanart.tv, Trakt, and Plex.</p>
      </div>

      <div className="space-y-3">
        {keys?.map(k => (
          <KeyCard
            key={k.key}
            keyInfo={k}
            onSave={(value) => saveMut.mutate({ updates: { [k.key]: value } })}
            saving={saveMut.isPending}
          />
        ))}
      </div>

      {saveMut.isSuccess && (
        <p className="text-sm text-green-400">✓ Saved successfully</p>
      )}

      {/* About Section */}
      <div className="border-t border-slate-800 pt-8 mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">About MovieStats</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-300">
              A personal movie library powered by <strong>TMDB</strong> and <strong>fanart.tv</strong> — search any film, save it to your local collection, and explore rich metadata, HD artwork, cast, crew, and more.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Version</p>
            <p className="text-sm text-slate-300">v1.7.0</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tech Stack</p>
            <div className="space-y-1 text-sm text-slate-300">
              <p><span className="text-slate-500">Backend:</span> Python 3.10+, FastAPI, SQLite</p>
              <p><span className="text-slate-500">Frontend:</span> React 18, Vite, TypeScript, Tailwind CSS</p>
              <p><span className="text-slate-500">Data:</span> TMDB API v3, fanart.tv API v3</p>
              <p><span className="text-slate-500">State:</span> TanStack Query (React Query), React Router</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Links</p>
            <div className="flex gap-3">
              <a
                href="https://github.com/trickdaddy24/movie-stats"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://github.com/trickdaddy24/movie-stats/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                MIT License
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KeyCard({
  keyInfo,
  onSave,
  saving,
}: {
  keyInfo: KeyStatus
  onSave: (value: string) => void
  saving: boolean
}) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState('')
  const [showVal, setShowVal]   = useState(false)

  const handleSave = () => {
    if (!value.trim()) return
    onSave(value.trim())
    setValue('')
    setEditing(false)
    setShowVal(false)
  }

  const handleClear = () => {
    onSave('')
    setEditing(false)
    setValue('')
  }

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Status + label */}
        <div className="flex items-center gap-3 min-w-0">
          {keyInfo.configured ? (
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-100">{keyInfo.label}</span>
              {keyInfo.required && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300">required</span>
              )}
            </div>
            {keyInfo.configured ? (
              <span className="text-xs text-slate-500 dark:text-slate-500 font-mono">{keyInfo.masked}</span>
            ) : (
              <a
                href={keyInfo.hint}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                Get your key <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
          keyInfo.configured
            ? 'bg-green-900/50 text-green-400'
            : 'bg-red-900/50 text-red-400'
        }`}>
          {keyInfo.configured ? 'Enabled' : 'Not set'}
        </span>
      </div>

      {/* Edit form — toggled */}
      {editing ? (
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input
              type={showVal ? 'text' : 'password'}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={`Enter ${keyInfo.label}`}
              autoFocus
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-600 px-3 py-1.5 text-sm text-slate-100
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowVal(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {showVal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!value.trim() || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500
                       disabled:opacity-40 text-sm text-white font-medium"
          >
            <Save size={13} /> Save
          </button>
          <button
            onClick={() => { setEditing(false); setValue('') }}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
          >
            {keyInfo.configured ? 'Update key' : 'Add key'}
          </button>
          {keyInfo.configured && (
            <button
              onClick={handleClear}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-900/40
                         text-slate-500 dark:text-slate-500 dark:text-slate-400 hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
