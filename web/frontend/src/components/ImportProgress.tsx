import { useEffect, useRef } from 'react'
import type { ProgressState } from '../hooks/useImportProgress'
import { CheckCircle, XCircle, MinusCircle, Clock, Square } from 'lucide-react'

function formatETA(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return ''
  if (seconds < 60) return `~${seconds}s remaining`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `~${m}m ${s}s remaining`
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

export default function ImportProgress({
  progress,
  onReset,
  onCancel,
}: {
  progress: ProgressState
  onReset: () => void
  onCancel?: () => void
}) {
  const logRef = useRef<HTMLDivElement>(null)
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  // Auto-scroll log to top (newest entries are prepended)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0
  }, [progress.log.length])

  if (!progress.running && !progress.done) return null

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>
            {progress.current} / {progress.total} movies
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {progress.done
              ? `Done in ${formatElapsed(progress.elapsedSeconds)}`
              : formatETA(progress.etaSeconds)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progress.done ? 'bg-green-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-slate-400 truncate">
          {progress.running && progress.currentTitle && (
            <span>
              <span
                className={
                  progress.currentStatus === 'imported'
                    ? 'text-green-400'
                    : progress.currentStatus === 'skipped'
                    ? 'text-slate-400'
                    : 'text-red-400'
                }
              >
                ●
              </span>{' '}
              {progress.currentTitle}
            </span>
          )}
        </div>
      </div>

      {/* Summary counts */}
      {(progress.done || progress.current > 0) && (
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle size={14} /> {progress.imported} imported
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <MinusCircle size={14} /> {progress.skipped} skipped
          </span>
          {progress.failed > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle size={14} /> {progress.failed} failed
            </span>
          )}
        </div>
      )}

      {/* Log panel */}
      {progress.log.length > 0 && (
        <div
          ref={logRef}
          className="max-h-40 overflow-y-auto rounded-lg bg-slate-950 p-2 space-y-0.5 font-mono text-xs"
        >
          {progress.log.map((entry, i) => (
            <div
              key={i}
              className={
                entry.status === 'imported'
                  ? 'text-green-400'
                  : entry.status === 'skipped'
                  ? 'text-slate-500'
                  : 'text-red-400'
              }
            >
              {entry.status === 'imported' ? '+ ' : entry.status === 'skipped' ? '− ' : '✗ '}
              {entry.title}
              {entry.reason && (
                <span className="text-slate-600 ml-1">— {entry.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {progress.done && progress.failureReason && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {progress.failureReason}
        </p>
      )}

      {progress.running && onCancel && (
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors w-fit"
        >
          <Square size={11} /> Stop Import
        </button>
      )}

      {progress.done && (
        <button
          onClick={onReset}
          className="text-xs text-indigo-400 hover:text-indigo-300 underline"
        >
          Start another import
        </button>
      )}
    </div>
  )
}
