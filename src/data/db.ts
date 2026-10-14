import Dexie, { type EntityTable } from 'dexie'

export interface Photo {
  id: number
  blob: Blob
  takenAt: string
  caption: string
  addedAt: number
}

export interface Song {
  id: number
  name: string
  blob: Blob
}

export const db = new Dexie('birlikte') as Dexie & {
  photos: EntityTable<Photo, 'id'>
  songs: EntityTable<Song, 'id'>
}
db.version(1).stores({ photos: '++id, takenAt' })
db.version(2).stores({ photos: '++id, takenAt', songs: '++id' })
