import { useState, useRef, useCallback } from 'react'
import type { ImportProgressEvent } from '../lib/api'

export interface ProgressState {
  running: boolean
  done: boolean
  total: number
  current: number
  currentTitle: string
  currentStatus: 'imported' | 'skipped' | 'failed' | ''
  imported: number
  skipped: number
  failed: number
  elapsedSeconds: number
  etaSeconds: number | null
  failureReason: string | null
  log: { title: string; status: string; reason?: string }[]
}

const INITIAL: ProgressState = {
  running: false,
  done: false,
  total: 0,
  current: 0,
  currentTitle: '',
  currentStatus: '',
  imported: 0,
  skipped: 0,
  failed: 0,
  elapsedSeconds: 0,
  etaSeconds: null,
  failureReason: null,
  log: [],
}

export function useImportProgress() {
  const [progress, setProgress] = useState<ProgressState>(INITIAL)
  const esRef = useRef<EventSource | null>(null)
  const startTimeRef = useRef<number>(0)

  const reset = useCallback(() => {
    esRef.current?.close()
    setProgress(INITIAL)
  }, [])

  const connect = useCallback((jobId: string) => {
    esRef.current?.close()
    startTimeRef.current = Date.now()
    setProgress((p) => ({ ...p, running: true, done: false }))

    const es = new EventSource(`/api/import/progress/${jobId}`)
    esRef.current = es

    es.onmessage = (e) => {
      const event: ImportProgressEvent = JSON.parse(e.data)

      setProgress((prev) => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000

        if (event.type === 'start') {
          return { ...prev, total: event.total ?? 0 }
        }

        if (event.type === 'progress') {
          const current = event.current ?? prev.current
          const total = event.total ?? prev.total
          const rate = current > 0 ? elapsed / current : 0
          const eta = rate * (total - current)
          return {
            ...prev,
            current,
            total,
            currentTitle: event.title ?? '',
            currentStatus: event.status ?? '',
            imported: prev.imported + (event.status === 'imported' ? 1 : 0),
            skipped: prev.skipped + (event.status === 'skipped' ? 1 : 0),
            failed: prev.failed + (event.status === 'failed' ? 1 : 0),
            elapsedSeconds: elapsed,
            etaSeconds: current < total ? Math.round(eta) : 0,
            log: [{ title: event.title ?? '', status: event.status ?? '', reason: event.reason }, ...prev.log].slice(0, 200),
          }
        }

        if (event.type === 'done') {
          es.close()
          return {
            ...prev,
            running: false,
            done: true,
            imported: event.imported ?? prev.imported,
            skipped: event.skipped ?? prev.skipped,
            failed: event.failed ?? prev.failed,
            elapsedSeconds: event.elapsed_seconds ?? elapsed,
            etaSeconds: 0,
            failureReason: event.reason ?? null,
          }
        }

        return prev
      })
    }

    es.onerror = () => {
      es.close()
      setProgress((p) => {
        // If already marked done (done event was received), just clear running flag
        if (p.done) return { ...p, running: false }
        // Connection dropped before done event — mark done so progress stays visible
        return { ...p, running: false, done: true }
      })
    }
  }, [])

  return { progress, connect, reset }
}
