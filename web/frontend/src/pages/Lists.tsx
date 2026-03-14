import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Loader2, Edit2 } from 'lucide-react'
import { getLists, createList, deleteList, updateList } from '../lib/api'

export default function Lists() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: lists, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
  })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDesc, setNewListDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameDesc, setRenameDesc] = useState('')
  const [renaming, setRenaming] = useState(false)

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return

    setCreating(true)
    try {
      await createList(newListName, newListDesc)
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      setNewListName('')
      setNewListDesc('')
      setShowCreateForm(false)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteList = async (listId: number) => {
    if (!confirm('Delete this list?')) return

    setDeleting(listId)
    try {
      await deleteList(listId)
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    } finally {
      setDeleting(null)
    }
  }

  const startRename = (listId: number, currentName: string, currentDesc: string) => {
    setRenamingId(listId)
    setRenameValue(currentName)
    setRenameDesc(currentDesc || '')
  }

  const handleRenameList = async (listId: number) => {
    if (!renameValue.trim()) return

    setRenaming(true)
    try {
      await updateList(listId, renameValue, renameDesc || undefined)
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      setRenamingId(null)
      setRenameValue('')
      setRenameDesc('')
    } finally {
      setRenaming(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  const favoritesList = lists?.find((l) => l.list_type === 'favorites')
  const watchlistList = lists?.find((l) => l.list_type === 'watchlist')
  const customLists = lists?.filter((l) => l.list_type === 'custom') || []

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Favorites */}
        {favoritesList && (
          <button
            onClick={() => navigate(`/lists/${favoritesList.id}`)}
            className="w-full text-left rounded-lg bg-slate-50 dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                ❤️ Favorites
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {favoritesList.movie_count} movie{favoritesList.movie_count !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Movies you've marked as favorites
            </p>
          </button>
        )}

        {/* Watchlist */}
        {watchlistList && (
          <button
            onClick={() => navigate(`/lists/${watchlistList.id}`)}
            className="w-full text-left rounded-lg bg-slate-50 dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                🎬 Watchlist
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {watchlistList.movie_count} movie{watchlistList.movie_count !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Movies you want to watch
            </p>
          </button>
        )}

        {/* Custom Lists */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Custom Lists
            </h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> New List
            </button>
          </div>

          {/* Create list form */}
          {showCreateForm && (
            <form
              onSubmit={handleCreateList}
              className="mb-6 rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  List Name
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Horror Films"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="Add a description..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                  disabled={creating}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newListName.trim() || creating}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewListName('')
                    setNewListDesc('')
                  }}
                  className="rounded-lg bg-slate-200 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Custom lists */}
          {customLists.length > 0 ? (
            <div className="grid gap-4">
              {customLists.map((list) => (
                <div key={list.id}>
                  {renamingId === list.id ? (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 space-y-3">
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
                          onClick={() => handleRenameList(list.id)}
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
                            setRenamingId(null)
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
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10 transition-all">
                      <button
                        onClick={() => navigate(`/lists/${list.id}`)}
                        className="flex-1 text-left"
                      >
                        <h4 className="font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                          {list.name}
                        </h4>
                        {list.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {list.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          {list.movie_count} movie{list.movie_count !== 1 ? 's' : ''}
                        </p>
                      </button>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => startRename(list.id, list.name, list.description || '')}
                          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                          title="Edit list"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteList(list.id)}
                          disabled={deleting === list.id}
                          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                          title="Delete list"
                        >
                          {deleting === list.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No custom lists yet. Create one to get started!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
