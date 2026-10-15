import { useSyncExternalStore } from 'react'

export type Theme = 'gece' | 'pastel' | 'acik' | 'geceyarisi'
export type HomeStyle = 'kalp' | 'klasik'

export interface Prefs {
  theme: Theme
  style: HomeStyle
  music: boolean
  /** Uygulamayla gelen hazır video Videolarım listesinden kaldırıldı mı */
  hideFilm: boolean
}

export const THEMES: { id: Theme; label: string; bar: string }[] = [
  { id: 'gece', label: 'Gece', bar: '#170c22' },
  { id: 'geceyarisi', label: 'Geceyarısı', bar: '#050b1c' },
  { id: 'pastel', label: 'Pastel', bar: '#ffe1ea' },
  { id: 'acik', label: 'Açık', bar: '#f6f3fb' },
]

const KEY = 'birlikte:prefs'
const DEFAULT: Prefs = { theme: 'gece', style: 'kalp', music: true, hideFilm: false }
const subs = new Set<() => void>()
let cache: Prefs | undefined

function read(): Prefs {
  if (cache) return cache
  try {
    cache = { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) }
  } catch {
    cache = DEFAULT
  }
  return cache
}

export function savePrefs(patch: Partial<Prefs>) {
  cache = { ...read(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // depolama kapalıysa oturum boyunca bellekte kalır
  }
  subs.forEach((f) => f())
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    read,
  )
}
