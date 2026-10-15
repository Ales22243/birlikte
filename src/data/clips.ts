import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Clip } from './db'

export const useClips = (): Clip[] | undefined => useLiveQuery(() => db.clips.orderBy('order').toArray(), [])

/** Videonun süresini okur; okunamazsa 0. */
function probe(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(blob)
    const done = (d: number) => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(d) ? d : 0)
    }
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => done(v.duration)
    v.onerror = () => done(0)
    setTimeout(() => done(0), 8000)
    v.src = url
  })
}

export async function addClips(files: FileList | File[]): Promise<number> {
  const last = await db.clips.orderBy('order').last()
  let order = (last?.order ?? 0) + 1
  let n = 0
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) continue
    const duration = await probe(f)
    if (!duration) continue
    await db.clips.add({ name: f.name.replace(/\.[^.]+$/, ''), blob: f, duration, order: order++ } as unknown as Clip)
    n++
  }
  return n
}

export const deleteClip = (id: number) => db.clips.delete(id)

/** Klibi listede bir yukarı (-1) ya da aşağı (+1) taşır. */
export async function moveClip(id: number, dir: -1 | 1) {
  const list = await db.clips.orderBy('order').toArray()
  const i = list.findIndex((c) => c.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  await db.transaction('rw', db.clips, async () => {
    await db.clips.update(list[i].id, { order: list[j].order })
    await db.clips.update(list[j].id, { order: list[i].order })
  })
}
