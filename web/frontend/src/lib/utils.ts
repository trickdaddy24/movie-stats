export function formatDate(d: string | undefined | null): string {
  if (!d) return 'Unknown'
  try {
    const date = new Date(d)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

export function formatYear(d: string | undefined | null): string {
  if (!d) return ''
  return d.substring(0, 4)
}

export function formatRuntime(mins: number | undefined | null): string {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function getRating(r: number | undefined | null): string {
  if (!r) return 'N/A'
  return `${r.toFixed(1)} / 10`
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
