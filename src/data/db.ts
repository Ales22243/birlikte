import Dexie, { type EntityTable } from 'dexie'

export interface Photo {
  id: number
  blob: Blob
  takenAt: string
  caption: string
  addedAt: number
}

export const db = new Dexie('birlikte') as Dexie & { photos: EntityTable<Photo, 'id'> }
db.version(1).stores({ photos: '++id, takenAt' })
