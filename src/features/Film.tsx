import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { PhotoView } from '../data/photos'
import { savePrefs, usePrefs } from '../data/prefs'
import { daysBetween, formatLong, parseISO } from '../lib/time'
import { db } from '../data/db'
import { startMusicBox, startPlaylist, type Player } from '../lib/music'
import { KenBurns, Polaroid } from '../ui/KenBurns'
import { HeartShape, IconClose } from '../ui/icons'

const SECONDS = 5

function RainOfHearts() {
  const reduce = useReducedMotion()
  const hearts = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        size: 12 + Math.random() * 16,
        delay: Math.random() * 8,
        dur: 7 + Math.random() * 5,
        drift: (Math.random() - 0.5) * 60,
      })),
    [],
  )
  if (reduce) return null
  return (
    <div className="rain" aria-hidden="true">
      {hearts.map((h) => (
        <motion.span
          key={h.id}
          style={{ left: `${h.left}%` }}
          initial={{ y: '105vh', opacity: 0 }}
          animate={{ y: '-10vh', x: h.drift, opacity: [0, 0.7, 0.7, 0] }}
          transition={{ duration: h.dur, delay: h.delay, repeat: Infinity, ease: 'linear' }}
        >
          <HeartShape size={h.size} />
        </motion.span>
      ))}
    </div>
  )
}

/** Anıları sırayla, hareketli geçişlerle, müzik eşliğinde oynatan tam ekran film. */
export function Film({ photos, start, onClose }: { photos: PhotoView[]; start: string; onClose: () => void }) {
  // Eskiden yeniye oynat
  const [list] = useState(() => [...photos].reverse())
  const [i, setI] = useState(0)
  const { music } = usePrefs()
  const done = i >= list.length

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setI((n) => n + 1), SECONDS * 1000)
    return () => clearTimeout(t)
  }, [i, done])

  useEffect(() => {
    if (!music) return
    let p: Player | undefined
    let cancelled = false
    db.songs
      .toArray()
      .then((songs) => {
        if (cancelled) return
        p = songs.length ? startPlaylist(songs.map((x) => x.blob)) : startMusicBox()
      })
      .catch(() => {
        // ses açılamazsa film sessiz devam eder
      })
    return () => {
      cancelled = true
      p?.stop()
    }
  }, [music])

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
  const polaroid = i % 3 === 2

  return (
    <div className="film" role="dialog" aria-modal="true" aria-label="Anı filmi">
      <AnimatePresence mode="sync">
        {!done && (polaroid ? <Polaroid key={p.id} src={p.url} index={i} seconds={SECONDS} /> : <KenBurns key={p.id} src={p.url} index={i} seconds={SECONDS} />)}
      </AnimatePresence>
      <div className="film-scrim" />
      {!done && <RainOfHearts />}

      <div className="film-top">
        <div className="segs" aria-hidden="true">
          {list.map((x, n) => (
            <span key={x.id} className={n < i ? 'full' : undefined}>
              {n === i && !done && <i key={i} style={{ animationDuration: `${SECONDS}s` }} />}
            </span>
          ))}
        </div>
        <div className="row">
          <button type="button" className="btn ghost small" aria-pressed={music} onClick={() => savePrefs({ music: !music })}>
            Müzik: {music ? 'açık' : 'kapalı'}
          </button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Filmi kapat">
            <IconClose />
          </button>
        </div>
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
