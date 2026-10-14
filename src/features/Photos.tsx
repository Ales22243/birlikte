import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Settings } from '../data/settings'
import { addPhotos, deletePhoto, deletePhotos, updatePhoto, usePhotos, type PhotoView } from '../data/photos'
import { daysBetween, formatLong, parseISO } from '../lib/time'
import { IconCheck, IconClose, IconPhotos, IconPlay, IconPlus, IconTrash } from '../ui/icons'
import { Film } from './Film'

function TileImage({ src }: { src: string }) {
  const [bad, setBad] = useState(false)
  return bad ? (
    <span className="tile-bad">Açılamadı</span>
  ) : (
    <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />
  )
}

function Viewer({ photos, index, start, onIndex, onClose }: { photos: PhotoView[]; index: number; start: string; onIndex: (i: number) => void; onClose: () => void }) {
  const p = photos[index]
  const [caption, setCaption] = useState(p.caption)
  const [armed, setArmed] = useState(false)
  const [asking, setAsking] = useState(false)
  const [failed, setFailed] = useState<number | null>(null)
  useEffect(() => {
    setCaption(p.caption)
    setArmed(false)
    setAsking(false)
  }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const go = onIndex
  const dayNo = daysBetween(parseISO(start), parseISO(p.takenAt)) + 1

  return (
    <motion.div className="viewer" role="dialog" aria-modal="true" aria-label="Fotoğraf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="viewer-top">
        <span>
          {index + 1} / {photos.length}
        </span>
        <div className="row">
          <button type="button" className="viewer-del" onClick={() => setAsking(true)} aria-label="Bu fotoğrafı sil">
            <IconTrash />
            Sil
          </button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Kapat">
            <IconClose />
          </button>
        </div>
      </div>

      {asking && (
        <div className="ask" role="alertdialog" aria-modal="true" aria-label="Fotoğrafı sil">
          <div className="ask-box">
            <h3>Bu fotoğrafı silelim mi?</h3>
            <p className="muted">Fotoğraf yalnızca bu telefondan silinir ve geri getirilemez.</p>
            <div className="row">
              <button
                type="button"
                className="btn danger"
                onClick={async () => {
                  await deletePhoto(p.id)
                  if (photos.length === 1) onClose()
                  else onIndex(Math.min(index, photos.length - 2))
                  setAsking(false)
                }}
              >
                <IconTrash />
                Sil
              </button>
              <button type="button" className="btn ghost" autoFocus onClick={() => setAsking(false)}>
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {failed === p.id && (
        <p className="viewer-fail" role="alert">
          Bu fotoğraf açılamadı. Silip yeniden ekleyebilirsiniz.
        </p>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          onError={() => setFailed(p.id)}
          key={p.id}
          src={p.url}
          alt={p.caption || formatLong(parseISO(p.takenAt))}
          className="viewer-img"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          onDragEnd={(_, info) => {
            if (info.offset.x < -80 && index < photos.length - 1) go(index + 1)
            else if (info.offset.x > 80 && index > 0) go(index - 1)
          }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
        />
      </AnimatePresence>

      <div className="viewer-panel">
        <p className="viewer-day">{dayNo >= 1 ? `${dayNo}. günümüz` : 'Bizden önce'}</p>
        <label className="field">
          <span>Tarih</span>
          <input type="date" value={p.takenAt} onChange={(e) => e.target.value && updatePhoto(p.id, { takenAt: e.target.value })} />
        </label>
        <label className="field">
          <span>Not</span>
          <input
            type="text"
            value={caption}
            maxLength={120}
            placeholder="Bu anıyı bir cümleyle anlat"
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== p.caption && updatePhoto(p.id, { caption })}
          />
        </label>
        <div className="row">
          <button type="button" className="btn ghost" disabled={index === 0} onClick={() => go(index - 1)}>
            Önceki
          </button>
          <button type="button" className="btn ghost" disabled={index === photos.length - 1} onClick={() => go(index + 1)}>
            Sonraki
          </button>
          <button
            type="button"
            className={armed ? 'btn danger' : 'btn ghost'}
            onClick={async () => {
              if (!armed) return setArmed(true)
              await deletePhoto(p.id)
              if (photos.length === 1) onClose()
              else onIndex(Math.min(index, photos.length - 2))
            }}
          >
            <IconTrash />
            {armed ? 'Silmek için tekrar dokun' : 'Sil'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function Photos({ settings }: { settings: Settings }) {
  const photos = usePhotos()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [film, setFilm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [note, setNote] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [confirm, setConfirm] = useState(false)

  const stopSelecting = () => {
    setSelecting(false)
    setPicked(new Set())
    setConfirm(false)
  }
  const toggle = (id: number) => {
    setConfirm(false)
    setPicked((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })
  }
  const removePicked = async () => {
    if (!confirm) return setConfirm(true)
    const n = picked.size
    await deletePhotos([...picked])
    stopSelecting()
    setNote(`${n} fotoğraf silindi.`)
  }

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files)
    if (input.current) input.current.value = ''
    setBusy(true)
    setNote('')
    const { added, failed } = await addPhotos(list, (d, t) => setProgress([d, t]))
    setBusy(false)
    setProgress(null)
    setNote(
      failed.length
        ? `${added} fotoğraf eklendi, ${failed.length} tanesi okunamadı — örnek: ${failed[0]}`
        : `${added} fotoğraf eklendi.`,
    )
  }

  const add = (
    <button type="button" className="btn" onClick={() => input.current?.click()} disabled={busy}>
      <IconPlus />
      {progress ? `Ekleniyor ${progress[0]}/${progress[1]}` : 'Fotoğraf ekle'}
    </button>
  )

  return (
    <section className="page">
      <header className="page-head">
        <h2>Anılarımız</h2>
        <div className="row">
          {photos && photos.length > 0 && !selecting && (
            <button type="button" className="btn ghost" onClick={() => setFilm(true)}>
              <IconPlay />
              Anı filmi
            </button>
          )}
          {photos && photos.length > 0 && (
            <button type="button" className="btn ghost" onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
              {selecting ? 'Vazgeç' : 'Seç'}
            </button>
          )}
          {!selecting && add}
        </div>
      </header>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      {progress && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress[1]} aria-valuenow={progress[0]} aria-label="Fotoğraflar ekleniyor">
          <i style={{ transform: `scaleX(${progress[1] ? progress[0] / progress[1] : 0})` }} />
          <span>Fotoğraflar hazırlanıyor, ekranı kapatmayın. iCloud'daki eski fotoğrafların önce telefona inmesi biraz sürebilir.</span>
        </div>
      )}
      {note && <p className="note" role="status">{note}</p>}

      {photos && photos.length === 0 && (
        <div className="empty">
          <IconPhotos />
          <p>Henüz fotoğraf yok.</p>
          <p className="muted">Eklediğiniz fotoğraflar ana ekranda yavaşça dönecek ve anı filminde oynayacak. Hepsi yalnızca bu telefonda saklanır.</p>
          {add}
        </div>
      )}

      <ul className="grid">
        {photos?.map((p, i) => {
          const d = daysBetween(parseISO(settings.start), parseISO(p.takenAt)) + 1
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`tile${selecting && picked.has(p.id) ? ' picked' : ''}`}
                onClick={() => (selecting ? toggle(p.id) : setOpen(i))}
                aria-label={p.caption || formatLong(parseISO(p.takenAt))}
                aria-pressed={selecting ? picked.has(p.id) : undefined}
              >
                <TileImage src={p.thumbUrl} />
                {d >= 1 && <span className="chip">{d}. gün</span>}
                {selecting && (
                  <span className="check" aria-hidden="true">
                    {picked.has(p.id) && <IconCheck />}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {selecting && (
        <div className="selectbar" role="region" aria-label="Seçili fotoğraflar">
          <span>{picked.size ? `${picked.size} seçili` : 'Silmek istediklerine dokun'}</span>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setPicked(new Set(photos?.map((p) => p.id)))}>
              Tümünü seç
            </button>
            <button type="button" className={confirm ? 'btn danger' : 'btn'} disabled={!picked.size} onClick={removePicked}>
              <IconTrash />
              {confirm ? `${picked.size} fotoğrafı kalıcı sil` : 'Sil'}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {photos && open !== null && photos[open] && (
          <Viewer key="viewer" photos={photos} index={open} start={settings.start} onIndex={setOpen} onClose={() => setOpen(null)} />
        )}
      </AnimatePresence>
      {film && photos && photos.length > 0 && <Film photos={photos} start={settings.start} onClose={() => setFilm(false)} />}
    </section>
  )
}
