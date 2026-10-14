import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS } from '../lib/defaults'

export interface Settings {
  a: string
  b: string
  start: string
}

const KEY = 'birlikte:v1'


const subs = new Set<() => void>()
let cache: Settings | null | undefined

function read(): Settings | null {
  if (cache !== undefined) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Settings) : DEFAULT_SETTINGS
  } catch {
    cache = DEFAULT_SETTINGS
  }
  return cache
}

export function saveSettings(s: Settings) {
  cache = s
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // depolama kapalıysa oturum boyunca bellekte kalır
  }
  subs.forEach((f) => f())
}

export function useSettings(): Settings | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    read,
  )
}

/** Paylaşım bağlantısından (?a=&b=&s=) gelen ön doldurma. */
export function readInvite(): Partial<Settings> {
  const p = new URLSearchParams(location.search)
  const s = p.get('s')
  return {
    a: p.get('a') ?? undefined,
    b: p.get('b') ?? undefined,
    start: s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined,
  }
}

export function inviteLink(s: Settings): string {
  const p = new URLSearchParams({ a: s.a, b: s.b, s: s.start })
  return `${location.origin}${location.pathname}?${p.toString()}`
}
