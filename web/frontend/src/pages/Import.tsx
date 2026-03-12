import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react'
import {
  previewTMDBList,
  startTMDBListImport,
  previewTrakt,
  startTraktImport,
  getPlexLibraries,
  getPlexSaved,
  previewPlex,
  startPlexImport,
  previewFolder,
  startFolderImport,
  type TMDBListPreview,
  type TraktPreview,
  type PlexPreview,
  type PlexLibrary,
} from '../lib/api'
import { useImportProgress } from '../hooks/useImportProgress'
import ImportProgress from '../components/ImportProgress'

// ---------------------------------------------------------------------------
// Preview list (first 5 items)
// ---------------------------------------------------------------------------

function PreviewList({
  movies,
  total,
  listName,
  description,
}: {
  movies: Array<{ tmdb_id?: number | null; title: string; year?: number | string | null; filename?: string }>
  total: number
  listName?: string
  description?: string
}) {
  return (
    <div className="mt-3 bg-slate-100 dark:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-xl p-4 space-y-2">
      {listName && <p className="text-sm font-semibold text-slate-900 dark:text-white">{listName}</p>}
      {description && <p className="text-xs text-slate-400 dark:text-slate-600 dark:text-slate-500 dark:text-slate-400">{description}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500">
        {total} movie{total !== 1 ? 's' : ''} found
      </p>
      {movies.length > 0 && (
        <ul className="space-y-1">
          {movies.slice(0, 5).map((m, i) => (
            <li key={i} className="text-xs text-slate-700 dark:text-slate-700 dark:text-slate-300 flex gap-2">
              <span className="text-slate-500 dark:text-slate-500 dark:text-slate-400 dark:text-slate-600">{i + 1}.</span>
              {m.title}
              {m.year && <span className="text-slate-500 dark:text-slate-500 dark:text-slate-500">({m.year})</span>}
              {m.filename && (
                <span className="text-slate-500 dark:text-slate-500 dark:text-slate-400 dark:text-slate-600 truncate max-w-xs">{m.filename}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {total > 5 && <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400 dark:text-slate-600 italic">…and {total - 5} more</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: TMDB List
// ---------------------------------------------------------------------------

function TMDBListTab({ progress, connect, reset, cancel }: ReturnType<typeof useImportProgress>) {
  const [listId, setListId] = useState('')
  const [preview, setPreview] = useState<TMDBListPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview() {
    if (!listId.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const data = await previewTMDBList(listId.trim())
      setPreview(data)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to load list'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!listId.trim()) return
    setError(null)
    try {
      const { job_id } = await startTMDBListImport(listId.trim())
      connect(job_id)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Import failed'
      setError(msg)
    }
  }

  if (progress.running || progress.done) {
    return <ImportProgress progress={progress} onReset={reset} onCancel={cancel} />
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-700 dark:text-slate-300 mb-1.5">
          TMDB List ID or URL
        </label>
        <input
          type="text"
          value={listId}
          onChange={(e) => {
            setListId(e.target.value)
            setPreview(null)
          }}
          placeholder="12345 or https://www.themoviedb.org/list/12345"
          className="w-full px-3 py-2.5 bg-white dark:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={!listId.trim() || loading}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-900 dark:text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Preview
        </button>
        <button
          onClick={handleImport}
          disabled={!listId.trim() || loading}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Import All
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {preview && (
        <PreviewList
          movies={preview.movies}
          total={preview.total}
          listName={preview.list_name}
          description={preview.description}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Trakt
// ---------------------------------------------------------------------------

function TraktTab({ progress, connect, reset, cancel }: ReturnType<typeof useImportProgress>) {
  const [username, setUsername] = useState('')
  const [listSlug, setListSlug] = useState('')
  const [preview, setPreview] = useState<TraktPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview() {
    if (!username.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const data = await previewTrakt(username.trim(), listSlug.trim() || undefined)
      setPreview(data)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to load Trakt data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!username.trim()) return
    setError(null)
    try {
      const { job_id } = await startTraktImport(username.trim(), listSlug.trim() || undefined)
      connect(job_id)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Import failed'
      setError(msg)
    }
  }

  if (progress.running || progress.done) {
    return <ImportProgress progress={progress} onReset={reset} onCancel={cancel} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-300">
          Requires <code className="bg-yellow-900/40 px-1 rounded">TRAKT_CLIENT_ID</code> in{' '}
          <code className="bg-yellow-900/40 px-1 rounded">.env</code>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Trakt Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setPreview(null)
          }}
          placeholder="your_trakt_username"
          className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          List Slug <span className="text-slate-500 dark:text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={listSlug}
          onChange={(e) => {
            setListSlug(e.target.value)
            setPreview(null)
          }}
          placeholder="my-list-name"
          className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Leave blank to import your watchlist</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={!username.trim() || loading}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Preview
        </button>
        <button
          onClick={handleImport}
          disabled={!username.trim() || loading}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Import All
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {preview && <PreviewList movies={preview.movies} total={preview.total} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Plex
// ---------------------------------------------------------------------------

function PlexTab({ progress, connect, reset, cancel }: ReturnType<typeof useImportProgress>) {
  // Auto-load saved credentials from .env via backend
  const { data: saved, isLoading: savedLoading } = useQuery({
    queryKey: ['plex-saved'],
    queryFn: getPlexSaved,
  })

  const [plexUrl, setPlexUrl] = useState('')
  const [plexToken, setPlexToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [libraries, setLibraries] = useState<PlexLibrary[] | null>(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [preview, setPreview] = useState<PlexPreview | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usingSaved, setUsingSaved] = useState(true)

  // When saved data loads, populate libraries if configured
  const savedReady = !savedLoading && saved?.configured && !saved.error && saved.libraries.length > 0

  const activeLibraries = usingSaved && savedReady ? saved!.libraries : libraries
  const activePlexUrl   = usingSaved && saved?.configured ? saved!.plex_url : plexUrl

  async function handleManualConnect() {
    if (!plexUrl.trim() || !plexToken.trim()) return
    setConnecting(true)
    setError(null)
    setLibraries(null)
    setSelectedKey('')
    setPreview(null)
    try {
      const libs = await getPlexLibraries(plexUrl.trim(), plexToken.trim())
      setLibraries(libs)
      if (libs.length === 1) setSelectedKey(libs[0].key)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Connection failed'
      setError(msg)
    } finally {
      setConnecting(false)
    }
  }

  async function handlePreview() {
    if (!selectedKey) return
    setPreviewing(true)
    setError(null)
    setPreview(null)
    try {
      const data = await previewPlex(activePlexUrl, plexToken.trim() || '', selectedKey)
      setPreview(data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Preview failed'
      setError(msg)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport() {
    if (!selectedKey) return
    setError(null)
    try {
      const selectedLibraryName = activeLibraries?.find(l => l.key === selectedKey)?.title ?? ''
      const { job_id } = await startPlexImport(activePlexUrl, plexToken.trim() || '', selectedKey, selectedLibraryName)
      connect(job_id)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Import failed'
      setError(msg)
    }
  }

  if (progress.running || progress.done) {
    return <ImportProgress progress={progress} onReset={reset} onCancel={cancel} />
  }

  return (
    <div className="space-y-4">

      {/* Saved credentials banner */}
      {savedLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking saved Plex credentials…
        </div>
      )}

      {!savedLoading && saved?.configured && !saved.error && (
        <div className="flex items-start justify-between gap-3 bg-green-900/20 border border-green-700 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-green-300 font-medium">Using saved Plex credentials</p>
              <p className="text-xs text-green-600 mt-0.5">{saved.plex_url}</p>
            </div>
          </div>
          <button
            onClick={() => { setUsingSaved(false) }}
            className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline flex-shrink-0"
          >
            Use different server
          </button>
        </div>
      )}

      {!savedLoading && saved?.configured && saved.error && (
        <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-yellow-300">Saved credentials found but server unreachable</p>
            <p className="text-xs text-yellow-600">{saved.error} — enter credentials manually below</p>
          </div>
        </div>
      )}

      {!savedLoading && !saved?.configured && (
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-slate-500 dark:text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400">
            No Plex credentials saved.{' '}
            <a href="/settings" className="text-indigo-400 hover:text-indigo-300 underline">
              Configure in Settings
            </a>{' '}
            or enter them below.
          </p>
        </div>
      )}

      {/* Manual entry — shown when not using saved or saved failed */}
      {(!usingSaved || (saved?.configured && saved.error)) && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Plex Server URL</label>
            <input
              type="text"
              value={plexUrl}
              onChange={(e) => { setPlexUrl(e.target.value); setLibraries(null); setPreview(null) }}
              placeholder="http://192.168.1.100:32400"
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Plex Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={plexToken}
                onChange={(e) => { setPlexToken(e.target.value); setLibraries(null); setPreview(null) }}
                placeholder="Your Plex token"
                className="w-full px-3 py-2.5 pr-10 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
              <button type="button" onClick={() => setShowToken(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              <a href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                target="_blank" rel="noopener noreferrer"
                className="text-brand-400 hover:text-brand-300 underline">
                How to find your Plex token
              </a>
            </p>
          </div>
          <button onClick={handleManualConnect}
            disabled={!plexUrl.trim() || !plexToken.trim() || connecting}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Connect
          </button>
        </>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Library picker */}
      {activeLibraries && activeLibraries.length > 0 && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Library</label>
            <select value={selectedKey}
              onChange={(e) => { setSelectedKey(e.target.value); setPreview(null) }}
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-brand-500 transition-colors">
              <option value="">Select a library…</option>
              {activeLibraries.map(lib => (
                <option key={lib.key} value={lib.key}>{lib.title}</option>
              ))}
            </select>
          </div>

          {selectedKey && (
            <div className="flex gap-2">
              <button onClick={handlePreview} disabled={previewing}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Preview
              </button>
              <button onClick={handleImport} disabled={previewing}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                Import All
              </button>
            </div>
          )}
        </div>
      )}

      {activeLibraries && activeLibraries.length === 0 && !savedLoading && (
        <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400">No movie libraries found on this Plex server.</p>
      )}

      {preview && <PreviewList movies={preview.movies} total={preview.total} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Folder
// ---------------------------------------------------------------------------

function FolderTab({ progress, connect, reset, cancel }: ReturnType<typeof useImportProgress>) {
  const [folderPath, setFolderPath] = useState('')
  const [recursive, setRecursive] = useState(true)
  const [preview, setPreview] = useState<{
    total: number
    movies: { title: string; year: number | null; filename: string }[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview() {
    if (!folderPath.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const data = await previewFolder(folderPath.trim(), recursive)
      setPreview(data)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to scan folder'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!folderPath.trim()) return
    setError(null)
    try {
      const { job_id } = await startFolderImport(folderPath.trim(), recursive)
      connect(job_id)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Import failed'
      setError(msg)
    }
  }

  if (progress.running || progress.done) {
    return <ImportProgress progress={progress} onReset={reset} onCancel={cancel} />
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Folder Path</label>
        <input
          type="text"
          value={folderPath}
          onChange={(e) => {
            setFolderPath(e.target.value)
            setPreview(null)
          }}
          placeholder="C:\Movies or /home/user/movies"
          className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
          Scans for .mkv, .mp4, .avi, .mov, .m4v, .ts, .wmv, .flv, .webm, .iso files
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={recursive}
          onChange={(e) => setRecursive(e.target.checked)}
          className="w-4 h-4 rounded accent-indigo-500"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">Scan subfolders recursively</span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={!folderPath.trim() || loading}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Preview
        </button>
        <button
          onClick={handleImport}
          disabled={!folderPath.trim() || loading}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Import All
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {preview && (
        <PreviewList
          movies={preview.movies}
          total={preview.total}
          description="Parsed from filenames — TMDB lookup happens on import"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Import page
// ---------------------------------------------------------------------------

type Tab = 'tmdb' | 'trakt' | 'plex' | 'folder'

export default function Import() {
  const [activeTab, setActiveTab] = useState<Tab>('tmdb')
  const importProgress = useImportProgress()

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tmdb', label: 'TMDB List' },
    { id: 'trakt', label: 'Trakt' },
    { id: 'plex', label: 'Plex' },
    { id: 'folder', label: 'Folder' },
  ]

  function handleTabChange(tab: Tab) {
    // Reset progress when switching tabs (unless an import is actively running)
    if (!importProgress.progress.running) {
      importProgress.reset()
    }
    setActiveTab(tab)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white
 mb-2">Bulk Import</h1>
      <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-400 mb-6">
        Import movies from TMDB lists, Trakt, your Plex library, or a local folder.
      </p>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white'
                : 'text-slate-500 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        {activeTab === 'tmdb' && <TMDBListTab {...importProgress} />}
        {activeTab === 'trakt' && <TraktTab {...importProgress} />}
        {activeTab === 'plex' && <PlexTab {...importProgress} />}
        {activeTab === 'folder' && <FolderTab {...importProgress} />}
      </div>
    </div>
  )
}
