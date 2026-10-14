import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Song } from './db'

export const useSongs = (): Song[] | undefined => useLiveQuery(() => db.songs.toArray(), [])

export async function addSongs(files: FileList | File[]): Promise<number> {
  let n = 0
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)) continue
    await db.songs.add({ name: f.name.replace(/\.[^.]+$/, ''), blob: f } as Song)
    n++
  }
  return n
}

export const deleteSong = (id: number) => db.songs.delete(id)
