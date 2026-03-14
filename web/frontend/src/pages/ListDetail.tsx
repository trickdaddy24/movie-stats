import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Loader2, Trash2, Download, Edit2 } from 'lucide-react'
import { getList, removeFromList, updateList, deleteList } from '../lib/api'
import { formatYear } from '../lib/utils'
import type { MovieInList } from '../lib/api'

export default function ListDetail() {
  const { listId } = useParams<{ listId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<number | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameDesc, setRenameDesc] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function exportAsCSV(listName: string, movies: MovieInList[]) {
    const headers = ['Title', 'Year', 'Rating', 'Runtime (min)', 'Genres']
    const rows = movies.map((m) => [
      `"${m.title.replace(/"/g, '""')}"`,
      formatYear(m.release_date) || '',
      m.rating ? m.rating.toFixed(1) : '',
      m.runtime || '',
      m.genres?.join(', ') || '',
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${listName.replace(/\s+/g, '_')}.csv`
    link.click()
  }

  function exportAsJSON(listName: string, movies: MovieInList[]) {
    const data = {
      listName,
      exportDate: new Date().toISOString(),
      movieCount: movies.length,
      movies: movies.map((m) => ({
        title: m.title,
        year: formatYear(m.release_date),
        rating: m.rating,
        runtime: m.runtime,
        genres: m.genres,
        releaseDate: m.release_date,
      })),
    }

    const json = JSON.stringify(data, null, 5)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${listName.replace(/\s+/g, '_')}.json`
    link.click()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => getList(Number(listId)),
    enabled: !!listId,
  })

  async function handleRemoveMovie(movieId: number) {
    if (!listId) return
    setRemoving(movieId)
    try {
      await removeFromList(Number(listId), movieId)
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    } finally {
      setRemoving(null)
    }
  }

  async function handleRenameList() {
    if (!listId || !renameValue.trim()) return
    setRenaming(true)
    try {
      await updateList(Number(listId), renameValue, renameDesc || undefined)
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      setIsRenaming(false)
      setRenameValue('')
      setRenameDesc('')
    } finally {
      setRenaming(false)
    }
  }

  async function handleDeleteList() {
    if (!listId || !confirm('Delete this list?')) return
    setDeleting(true)
    try {
      await deleteList(Number(listId))
      navigate('/lists')
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/lists')}
          className="flex items-center gap-2 text-brand-600 hover:text-brand-500 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Lists
        </button>
        <p className="text-slate-600 dark:text-slate-400">List not found</p>
      </div>
    )
  }

  const { list, movies } = data

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <button
          onClick={() => navigate('/lists')}
          className="flex items-center gap-2 text-brand-600 hover:text-brand-500 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Lists
        </button>

        <div className="mb-8">
          {isRenaming ? (
            <div className="mb-6 rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 space-y-3 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  List Name
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="List name"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                  disabled={renaming}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={renameDesc}
                  onChange={(e) => setRenameDesc(e.target.value)}
                  placeholder="Add a description..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                  disabled={renaming}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRenameList}
                  disabled={!renameValue.trim() || renaming}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {renaming ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save'
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsRenaming(false)
                    setRenameValue('')
                    setRenameDesc('')
                  }}
                  disabled={renaming}
                  className="rounded-lg bg-slate-200 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  {list.name}
                </h1>
                {list.description && (
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{list.description}</p>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                  {movies.length} movie{movies.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {list.list_type === 'custom' && (
                  <>
                    <button
                      onClick={() => {
                        setIsRenaming(true)
                        setRenameValue(list.name)
                        setRenameDesc(list.description || '')
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
                      title="Edit list"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={handleDeleteList}
                      disabled={deleting}
                      className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      title="Delete list"
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete
                    </button>
                  </>
                )}
                {movies.length > 0 && (
                  <>
                    <button
                      onClick={() => exportAsCSV(list.name, movies)}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
                      title="Export as CSV"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                    <button
                      onClick={() => exportAsJSON(list.name, movies)}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
                      title="Export as JSON"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Movies grid */}
        {movies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {movies.map((movie) => (
              <div
                key={movie.id}
                className="group bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                      <span className="text-xs text-center px-2">{movie.title}</span>
                    </div>
                  )}

                  {/* Rating */}
                  {movie.rating != null && movie.rating > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 rounded-md px-1.5 py-0.5">
                      <span className="text-xs font-semibold text-yellow-400">
                        {movie.rating.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveMovie(movie.id)}
                    disabled={removing === movie.id}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from list"
                  >
                    {removing === movie.id ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Trash2 className="w-6 h-6 text-red-400" />
                    )}
                  </button>
                </div>

                {/* Info */}
                <div className="p-2">
                  <h3 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-2">
                    {movie.title}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                    {formatYear(movie.release_date)}
                  </p>
                  {movie.genres && movie.genres.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {movie.genres.slice(0, 1).map((g) => (
                        <span key={g} className="text-[8px] px-1 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400">
              No movies in this list yet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
