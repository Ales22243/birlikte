import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PhotoView } from '../data/photos'
import { daysBetween, formatLong, parseISO } from '../lib/time'
import { KenBurns } from '../ui/KenBurns'
import { IconClose } from '../ui/icons'

const SECONDS = 5

/** Anıları sırayla, hareketli geçişlerle oynatan tam ekran film. */
export function Film({ photos, start, onClose }: { photos: PhotoView[]; start: string; onClose: () => void }) {
  // Eskiden yeniye oynat
  const [list] = useState(() => [...photos].reverse())
  const [i, setI] = useState(0)
  const done = i >= list.length

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setI((n) => n + 1), SECONDS * 1000)
    return () => clearTimeout(t)
  }, [i, done])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, list.length))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [list.length, onClose])

  const p = list[Math.min(i, list.length - 1)]
  const date = parseISO(p.takenAt)
  const dayNo = daysBetween(parseISO(start), date) + 1

  return (
    <div className="film" role="dialog" aria-modal="true" aria-label="Anı filmi">
      <AnimatePresence mode="sync">{!done && <KenBurns key={p.id} src={p.url} index={i} seconds={SECONDS} />}</AnimatePresence>
      <div className="film-scrim" />

      <div className="film-top">
        <div className="segs" aria-hidden="true">
          {list.map((x, n) => (
            <span key={x.id} className={n < i ? 'full' : undefined}>
              {n === i && !done && <i key={i} style={{ animationDuration: `${SECONDS}s` }} />}
            </span>
          ))}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Filmi kapat">
          <IconClose />
        </button>
      </div>

      {!done && (
        <>
          <button type="button" className="film-hit left" aria-label="Önceki" onClick={() => setI((n) => Math.max(n - 1, 0))} />
          <button type="button" className="film-hit right" aria-label="Sonraki" onClick={() => setI((n) => n + 1)} />
          <AnimatePresence mode="wait">
            <motion.div
              key={p.id}
              className="film-cap"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              {dayNo >= 1 && <strong>{dayNo}. gün</strong>}
              <span>{formatLong(date)}</span>
              {p.caption && <em>{p.caption}</em>}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {done && (
        <motion.div className="film-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <p>Daha çok anımız olacak.</p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setI(0)}>
              Baştan oynat
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Kapat
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
