import { useEffect, useMemo, useRef, useState } from 'react'
import type { Settings } from '../data/settings'
import { usePhotos } from '../data/photos'
import { useSongs } from '../data/songs'
import { Animator, H, W, pickRecorderFormat, type AnimStyle } from '../lib/animator'
import { startMusicBox, startPlaylist, startSongsInto, type Player } from '../lib/music'
import { IconPlay } from '../ui/icons'

type Phase = 'idle' | 'loading' | 'preview' | 'recording' | 'done'
type MusicChoice = 'kutu' | 'sarki' | 'sessiz'

const COUNTS = [5, 10, 20, 0] as const
const STYLES: { id: AnimStyle; label: string }[] = [
  { id: 'karisik', label: 'Karışık' },
  { id: 'yakin', label: 'Yakınlaşma' },
  { id: 'polaroid', label: 'Polaroid' },
]

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

async function fontsReady() {
  try {
    await Promise.all([document.fonts.load("300 100px Fraunces"), document.fonts.load("italic 400 40px Fraunces"), document.fonts.load("500 30px Figtree")])
  } catch {
    // yazı tipi yüklenemezse yedek yazı tipleri kullanılır
  }
}

export function Anim({ settings }: { settings: Settings }) {
  const photos = usePhotos()
  const songs = useSongs()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [count, setCount] = useState<(typeof COUNTS)[number]>(10)
  const [style, setStyle] = useState<AnimStyle>('karisik')
  const [music, setMusic] = useState<MusicChoice>('kutu')
  const [phase, setPhase] = useState<Phase>('idle')
  const [t, setT] = useState(0)
  const [total, setTotal] = useState(0)
  const [msg, setMsg] = useState('')
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string } | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const format = useMemo(() => pickRecorderFormat(), [])

  // Seçilen sayıda en yeni fotoğrafı, eskiden yeniye sıralar
  const chosen = useMemo(() => {
    if (!photos) return []
    const list = count === 0 ? photos : photos.slice(0, count)
    return [...list].reverse()
  }, [photos, count])

  const estimate = chosen.length ? 3.6 + chosen.length * 3.2 + 3.4 : 0

  // Boşta duran tuvale kapak karesi çiz
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'done') return
    let live = true
    void fontsReady().then(() => {
      const c = canvas.current
      if (!live || !c) return
      const a = new Animator({ photos: [], a: settings.a, b: settings.b, start: settings.start, style: 'karisik' })
      a.draw(c.getContext('2d')!, 2.9)
    })
    return () => {
      live = false
    }
  }, [phase, settings])

  useEffect(() => {
    return () => {
      stopRef.current?.()
      if (video) URL.revokeObjectURL(video.url)
    }
  }, [video])

  const run = async (mode: 'preview' | 'record') => {
    const c = canvas.current
    if (!c || !chosen.length) return
    stopRef.current?.()
    if (video) {
      URL.revokeObjectURL(video.url)
      setVideo(null)
    }
    setMsg('')
    setPhase('loading')
    await fontsReady()

    const animator = new Animator({
      photos: chosen.map((p) => ({ blob: p.blob, takenAt: p.takenAt, caption: p.caption })),
      a: settings.a,
      b: settings.b,
      start: settings.start,
      style,
    })
    await animator.prepare()
    const ctx = c.getContext('2d')!
    const duration = animator.duration
    setTotal(duration)

    let player: Player | undefined
    let actx: AudioContext | undefined
    let recorder: MediaRecorder | undefined
    let stream: MediaStream | undefined
    let wake: WakeLockSentinel | undefined
    let raf = 0
    let finished = false
    const chunks: BlobPart[] = []
    const songBlobs = (songs ?? []).map((s) => s.blob)

    try {
      if (mode === 'record') {
        if (!format) throw new Error('Bu tarayıcı video kaydını desteklemiyor.')
        stream = c.captureStream(30)
        if (music !== 'sessiz') {
          actx = new AudioContext()
          await actx.resume()
          const dest = actx.createMediaStreamDestination()
          player =
            music === 'sarki' && songBlobs.length
              ? await startSongsInto(songBlobs, { ctx: actx, out: dest }, duration)
              : startMusicBox(0.6, { ctx: actx, out: dest })
          dest.stream.getAudioTracks().forEach((tr) => stream!.addTrack(tr))
        }
        recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 4_000_000 })
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
        recorder.start(500)
        try {
          wake = await navigator.wakeLock?.request('screen')
        } catch {
          // ekran kilidi engellenemezse kullanıcı uyarısı yeterli
        }
      } else if (music !== 'sessiz') {
        player = music === 'sarki' && songBlobs.length ? startPlaylist(songBlobs) : startMusicBox()
      }
    } catch (e) {
      setPhase('idle')
      setMsg((e as Error).message || 'Başlatılamadı.')
      animator.dispose()
      return
    }

    const cleanup = () => {
      cancelAnimationFrame(raf)
      player?.stop()
      stream?.getTracks().forEach((tr) => tr.stop())
      if (actx) setTimeout(() => void actx!.close(), 700)
      void wake?.release()
      document.removeEventListener('visibilitychange', onHide)
      animator.dispose()
      stopRef.current = null
    }

    const finish = (ok: boolean) => {
      if (finished) return
      finished = true
      if (mode === 'record' && recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          cleanup()
          if (!ok) return setPhase('idle')
          const blob = new Blob(chunks, { type: format!.mime.split(';')[0] })
          if (blob.size < 1000) {
            setPhase('idle')
            return setMsg('Video oluşturulamadı. Tekrar deneyin.')
          }
          setVideo({ url: URL.createObjectURL(blob), blob, ext: format!.ext })
          setPhase('done')
        }
        recorder.stop()
      } else {
        cleanup()
        setPhase('idle')
      }
    }

    const onHide = () => {
      if (document.hidden && mode === 'record') {
        setMsg('Uygulamadan çıktığınız için kayıt durdu. Ekranı açık tutup yeniden başlatın.')
        finish(false)
      }
    }
    document.addEventListener('visibilitychange', onHide)
    stopRef.current = () => finish(false)

    setPhase(mode === 'record' ? 'recording' : 'preview')
    const t0 = performance.now()
    let lastUi = 0
    const frame = () => {
      const now = (performance.now() - t0) / 1000
      if (now >= duration) {
        animator.draw(ctx, duration - 0.001)
        return finish(true)
      }
      animator.prefetch(now)
      animator.draw(ctx, now)
      if (now - lastUi > 0.25) {
        lastUi = now
        setT(now)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
  }

  const save = async () => {
    if (!video) return
    const file = new File([video.blob], `birlikte-anilar.${video.ext}`, { type: video.blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Birlikte anılarımız' })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const a = document.createElement('a')
    a.href = video.url
    a.download = file.name
    a.click()
  }

  const busy = phase === 'loading' || phase === 'preview' || phase === 'recording'
  const empty = photos && photos.length === 0

  return (
    <section className="page">
      <header className="page-head">
        <h2>Animasyon</h2>
      </header>

      <div className="stage-wrap">
        {video && phase === 'done' ? (
          <video className="anim-video" src={video.url} controls playsInline />
        ) : (
          <canvas ref={canvas} className="anim-canvas" width={W} height={H} aria-label="Animasyon önizlemesi" />
        )}
        {phase === 'loading' && <p className="anim-badge">Fotoğraflar hazırlanıyor...</p>}
        {phase === 'recording' && <p className="anim-badge rec">● Kaydediliyor {fmtSec(t)} / {fmtSec(total)}</p>}
      </div>

      {phase === 'recording' && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(t)} aria-label="Video kaydı">
          <i style={{ transform: `scaleX(${total ? t / total : 0})` }} />
          <span>Video telefonda gerçek zamanlı hazırlanıyor. Bu ekranda kalın, uygulamadan çıkmayın.</span>
        </div>
      )}
      {msg && <p className="note" role="status">{msg}</p>}

      {empty && <p className="muted">Animasyon için önce Anılar'a fotoğraf ekleyin.</p>}

      {phase === 'done' && video ? (
        <div className="row">
          <button type="button" className="btn" onClick={save}>
            Kaydet veya paylaş
          </button>
          <button type="button" className="btn ghost" onClick={() => setPhase('idle')}>
            Yeniden yap
          </button>
        </div>
      ) : (
        !empty && (
          <>
            <div className="card wide opts">
              <fieldset>
                <legend>Kaç fotoğraf</legend>
                <div className="seg4" role="radiogroup">
                  {COUNTS.map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={count === n} disabled={busy} onClick={() => setCount(n)}>
                      {n === 0 ? 'Hepsi' : `Son ${n}`}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Stil</legend>
                <div className="seg3" role="radiogroup">
                  {STYLES.map((s) => (
                    <button key={s.id} type="button" role="radio" aria-checked={style === s.id} disabled={busy} onClick={() => setStyle(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Müzik</legend>
                <div className="seg3" role="radiogroup">
                  <button type="button" role="radio" aria-checked={music === 'kutu'} disabled={busy} onClick={() => setMusic('kutu')}>
                    Müzik kutusu
                  </button>
                  <button type="button" role="radio" aria-checked={music === 'sarki'} disabled={busy || !songs?.length} onClick={() => setMusic('sarki')}>
                    Şarkılarım
                  </button>
                  <button type="button" role="radio" aria-checked={music === 'sessiz'} disabled={busy} onClick={() => setMusic('sessiz')}>
                    Sessiz
                  </button>
                </div>
                {!songs?.length && <small className="muted">Şarkılarım için Ayarlar'dan şarkı ekleyin.</small>}
              </fieldset>
              <p className="muted small-note">
                {chosen.length} fotoğraf · yaklaşık {fmtSec(estimate)} uzunluğunda dikey video.
              </p>
            </div>

            <div className="row">
              {busy ? (
                <button type="button" className="btn ghost" onClick={() => stopRef.current?.()}>
                  Durdur
                </button>
              ) : (
                <>
                  <button type="button" className="btn ghost" disabled={!chosen.length} onClick={() => run('preview')}>
                    <IconPlay />
                    Önizle
                  </button>
                  <button type="button" className="btn" disabled={!chosen.length || !format} onClick={() => run('record')}>
                    Video oluştur
                  </button>
                </>
              )}
            </div>
            {!format && <p className="note">Bu tarayıcı video kaydını desteklemiyor. iPhone'da Safari'yi güncelleyin.</p>}
          </>
        )
      )}
    </section>
  )
}
