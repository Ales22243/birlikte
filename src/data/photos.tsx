import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Photo } from './db'
import { toISO } from '../lib/time'

export interface PhotoView extends Photo {
  url: string
}

const Ctx = createContext<PhotoView[] | undefined>(undefined)

export function PhotosProvider({ children }: { children: ReactNode }) {
  const rows = useLiveQuery(() => db.photos.orderBy('takenAt').reverse().toArray(), [])
  const [views, setViews] = useState<PhotoView[]>()

  useEffect(() => {
    if (!rows) return
    const v = rows.map((r) => ({ ...r, url: URL.createObjectURL(r.blob) }))
    setViews(v)
    return () => v.forEach((x) => URL.revokeObjectURL(x.url))
  }, [rows])

  return <Ctx.Provider value={views}>{children}</Ctx.Provider>
}

export const usePhotos = () => useContext(Ctx)

async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.84))
}

/** Seçilen dosyaları küçültüp kaydeder; okunamayanların sayısını döndürür. */
export async function addPhotos(files: FileList | File[]): Promise<number> {
  let failed = 0
  for (const f of Array.from(files)) {
    try {
      const blob = await shrink(f)
      await db.photos.add({
        blob,
        takenAt: toISO(new Date(f.lastModified || Date.now())),
        caption: '',
        addedAt: Date.now(),
      } as Photo)
    } catch {
      failed++
    }
  }
  return failed
}

export const updatePhoto = (id: number, patch: Partial<Pick<Photo, 'caption' | 'takenAt'>>) =>
  db.photos.update(id, patch)
export const deletePhoto = (id: number) => db.photos.delete(id)
