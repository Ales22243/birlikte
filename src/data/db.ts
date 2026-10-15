import Dexie, { type EntityTable } from 'dexie'

export interface Photo {
  id: number
  blob: Blob
  thumb?: Blob
  /** Küçük sürüm üretilemediyse true; bir daha denenmez. */
  thumbFailed?: boolean
  takenAt: string
  caption: string
  addedAt: number
}

export interface Song {
  id: number
  name: string
  blob: Blob
}

export interface Clip {
  id: number
  name: string
  blob: Blob
  /** Saniye; eklenirken okunur. */
  duration: number
  order: number
}

export interface Note {
  id: number
  title: string
  text: string
  date: string
  time: string
  createdAt: number
}

export const db = new Dexie('birlikte') as Dexie & {
  photos: EntityTable<Photo, 'id'>
  songs: EntityTable<Song, 'id'>
  notes: EntityTable<Note, 'id'>
  clips: EntityTable<Clip, 'id'>
}
db.version(1).stores({ photos: '++id, takenAt' })
db.version(2).stores({ photos: '++id, takenAt', songs: '++id' })
db.version(3).stores({ photos: '++id, takenAt', songs: '++id', notes: '++id, date' })
db.version(4).stores({ photos: '++id, takenAt', songs: '++id', notes: '++id, date', clips: '++id, order' })
