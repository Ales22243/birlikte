import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Photo } from './db'
import { toISO } from '../lib/time'

export interface PhotoView extends Photo {
  url: string
  /** Izgara için küçük sürüm; eski fotoğraflarda yoktur, o zaman tam boy kullanılır. */
  thumbUrl: string
}

const Ctx = createContext<PhotoView[] | undefined>(undefined)

interface Urls {
  url: string
  thumbUrl: string
  thumbBlob?: Blob
}

export function PhotosProvider({ children }: { children: ReactNode }) {
  const rows = useLiveQuery(() => db.photos.orderBy('takenAt').reverse().toArray(), [])
  const [views, setViews] = useState<PhotoView[]>()
  // Her değişiklikte tüm adresleri yeniden üretmeyiz; yalnızca yeni gelenler için üretir, silinenleri bırakırız.
  const cache = useRef(new Map<number, Urls>())

  useEffect(() => {
    if (!rows) return
    const live = new Set(rows.map((r) => r.id))
    for (const [id, u] of cache.current) {
      if (!live.has(id)) {
        URL.revokeObjectURL(u.url)
        if (u.thumbBlob) URL.revokeObjectURL(u.thumbUrl)
        cache.current.delete(id)
      }
    }
    setViews(
      rows.map((r) => {
        let u = cache.current.get(r.id)
        if (u && r.thumb && !u.thumbBlob) {
          u = { url: u.url, thumbUrl: URL.createObjectURL(r.thumb), thumbBlob: r.thumb }
          cache.current.set(r.id, u)
        }
        if (!u) {
          const url = URL.createObjectURL(r.blob)
          u = r.thumb ? { url, thumbUrl: URL.createObjectURL(r.thumb), thumbBlob: r.thumb } : { url, thumbUrl: url }
          cache.current.set(r.id, u)
        }
        return { ...r, url: u.url, thumbUrl: u.thumbUrl }
      }),
    )
  }, [rows])

  // Eski fotoğrafların küçük sürümünü arka planda, birer birer üretir; ızgara hafifler.
  const migrating = useRef(false)
  useEffect(() => {
    if (!rows || migrating.current) return
    const todo = rows.filter((r) => !r.thumb && !r.thumbFailed)
    if (!todo.length) return
    migrating.current = true
    void (async () => {
      // Kullanıcı kaydırırken ağır iş yapmamak için açılıştan sonra bekler, her fotoğraftan sonra dinlenir.
      await new Promise((res) => setTimeout(res, 4000))
      for (const r of todo) {
        try {
          const { thumb } = await prepare(r.blob)
          await db.photos.update(r.id, { thumb })
        } catch {
          await db.photos.update(r.id, { thumbFailed: true })
        }
        await new Promise((res) => setTimeout(res, 400))
      }
      migrating.current = false
    })()
  }, [rows])

  useEffect(() => {
    const c = cache.current
    return () => {
      for (const u of c.values()) {
        URL.revokeObjectURL(u.url)
        if (u.thumbBlob) URL.revokeObjectURL(u.thumbUrl)
      }
      c.clear()
    }
  }, [])

  return <Ctx.Provider value={views}>{children}</Ctx.Provider>
}

export const usePhotos = () => useContext(Ctx)

export interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

/** Dosyayı çözer: önce doğrudan, olmazsa küçülterek çözerek, o da olmazsa <img> ile (iPhone'un bellek sınırları için). */
export async function decode(file: Blob): Promise<Decoded> {
  const fromBitmap = (bmp: ImageBitmap): Decoded => ({ source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() })
  try {
    return fromBitmap(await createImageBitmap(file, { imageOrientation: 'from-image' }))
  } catch {
    // çok büyük (ör. 48 MP) fotoğraflar tam çözülemeyebilir; çözerken küçült
  }
  try {
    return fromBitmap(await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: 2000, resizeQuality: 'medium' }))
  } catch {
    // son çare: tarayıcının kendi <img> çözücüsü
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

function render(d: Decoded, max: number, quality: number): Promise<Blob> {
  const k = Math.min(1, max / Math.max(d.width, d.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(d.width * k))
  c.height = Math.max(1, Math.round(d.height * k))
  c.getContext('2d')!.drawImage(d.source, 0, 0, c.width, c.height)
  return new Promise((res, rej) =>
    c.toBlob(
      (b) => {
        // iPhone, kullanılan tuvalin belleğini ancak boyutu sıfırlanınca geri verir.
        c.width = c.height = 0
        b ? res(b) : rej(new Error('Görsel oluşturulamadı'))
      },
      'image/jpeg',
      quality,
    ),
  )
}

/** Tam boy (1600 px) ve ızgara için küçük (480 px) sürümü üretir. */
async function prepare(file: Blob): Promise<{ blob: Blob; thumb: Blob }> {
  const d = await decode(file)
  try {
    const blob = await render(d, 1600, 0.82)
    const thumb = await render(d, 480, 0.7)
    return { blob, thumb }
  } finally {
    d.release()
  }
}

const breathe = () => new Promise<void>((r) => setTimeout(r, 30))

export interface AddResult {
  added: number
  failed: string[]
}

/** Seçilen dosyaları birer birer işler (bellek dolmasın diye) ve ilerlemeyi bildirir. */
export async function addPhotos(files: FileList | File[], onProgress?: (done: number, total: number) => void): Promise<AddResult> {
  const list = Array.from(files)
  const failed: string[] = []
  let added = 0
  onProgress?.(0, list.length)
  for (const [i, f] of list.entries()) {
    try {
      const { blob, thumb } = await prepare(f)
      await db.photos.add({
        blob,
        thumb,
        takenAt: toISO(new Date(f.lastModified || Date.now())),
        caption: '',
        addedAt: Date.now() + i,
      } as Photo)
      added++
    } catch (e) {
      failed.push(`${f.name || 'adsız'} (${(e as Error).name || 'hata'}, ${Math.round(f.size / 1e6)} MB, ${f.type || 'tür yok'})`)
    }
    onProgress?.(i + 1, list.length)
    await breathe()
  }
  return { added, failed }
}

export const updatePhoto = (id: number, patch: Partial<Pick<Photo, 'caption' | 'takenAt'>>) =>
  db.photos.update(id, patch)
export const deletePhoto = (id: number) => db.photos.delete(id)
export const deletePhotos = (ids: number[]) => db.photos.bulkDelete(ids)

const toDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

/** Adlar, tarih ve tüm fotoğrafları tek bir .json yedek dosyası olarak paylaşır ya da indirir. */
export async function exportBackup(settings: unknown, onProgress?: (done: number, total: number) => void): Promise<number> {
  const rows = await db.photos.toArray()
  // Tek devasa metin yerine parça parça birleştiririz; bellek kullanımı düşük kalır.
  const parts: BlobPart[] = [`{"app":"birlikte","v":1,"settings":${JSON.stringify(settings)},"photos":[`]
  for (const [i, p] of rows.entries()) {
    const item = { takenAt: p.takenAt, caption: p.caption, addedAt: p.addedAt, data: await toDataUrl(p.blob) }
    parts.push((i ? ',' : '') + JSON.stringify(item))
    onProgress?.(i + 1, rows.length)
    await breathe()
  }
  parts.push(']}')
  const name = `birlikte-yedek-${toISO(new Date())}.json`
  const file = new File(parts, name, { type: 'application/json' })
  // Telefonlarda paylaşım menüsünü (WhatsApp, Dosyalar, AirDrop) açar; olmazsa dosya olarak indirir.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Birlikte yedek' })
      return rows.length
    } catch (e) {
      if ((e as Error).name === 'AbortError') return rows.length
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  return rows.length
}

/** Yedek dosyasındaki fotoğrafları ekler; ad ve tarihi döndürür. */
export async function importBackup(file: File, onProgress?: (done: number, total: number) => void): Promise<{ settings: unknown; count: number }> {
  const j = JSON.parse(await file.text())
  if (j?.app !== 'birlikte' || !Array.isArray(j.photos)) throw new Error('Geçersiz yedek')
  const items = j.photos as { takenAt: string; caption: string; addedAt: number; data: string }[]
  let count = 0
  for (const [i, p] of items.entries()) {
    const blob = await (await fetch(p.data)).blob()
    let thumb: Blob | undefined
    try {
      thumb = (await prepare(blob)).thumb
    } catch {
      // küçük sürüm üretilemezse tam boy gösterilir
    }
    await db.photos.add({ blob, thumb, takenAt: p.takenAt, caption: p.caption ?? '', addedAt: p.addedAt ?? Date.now() } as Photo)
    count++
    onProgress?.(i + 1, items.length)
    await breathe()
  }
  return { settings: j.settings, count }
}
