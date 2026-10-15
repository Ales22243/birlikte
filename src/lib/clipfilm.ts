import { daysBetween, parseISO } from './time'
import { HEART_PATH } from './cartoon-people'
import type { Sink } from './music'

// Kullanıcının kendi videolarından (ör. yapay zekâ ile üretilmiş klipler) dikey film:
// açılış kartı → klipler arka arkaya, yumuşak geçişle → bitiş kartı.
// Klipler yalnızca cihazda kalır; burada sadece oynatılıp tuvale çizilir.

export const FW = 720
export const FH = 1280
const INTRO = 3
const XF = 0.7
const OUTRO = 4.5

export type ClipFit = 'sigdir' | 'kirp'
/** mute: sessiz · native: video kendi sesini hoparlörden çalar · Sink: sesi kayda yönlendir */
export type ClipAudio = 'mute' | 'native' | Sink

export interface ClipFilmInput {
  clips: Blob[]
  a: string
  b: string
  start: string
  fit: ClipFit
}

const SERIF = "Fraunces, 'Iowan Old Style', Georgia, serif"
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

interface Track {
  v: HTMLVideoElement
  url: string
  start: number
  dur: number
}

export class ClipFilm {
  private input: ClipFilmInput
  private days: number
  private tracks: Track[] = []
  private heart = new Path2D(HEART_PATH)
  // bulanık arka plan: küçük kare → orta boy → tam ekran (iki adımlı büyütme kareli görünmez)
  private soft = document.createElement('canvas')
  private mid = document.createElement('canvas')
  private sources: MediaElementAudioSourceNode[] = []

  constructor(input: ClipFilmInput) {
    this.input = input
    this.days = Math.max(0, daysBetween(parseISO(input.start), new Date()))
    this.soft.width = 18
    this.soft.height = 32
    this.mid.width = 90
    this.mid.height = 160
  }

  get duration() {
    const last = this.tracks[this.tracks.length - 1]
    return last ? last.start + last.dur - 1.5 + OUTRO : INTRO + OUTRO
  }

  async prepare() {
    let at = INTRO - XF
    for (const blob of this.input.clips) {
      const v = document.createElement('video')
      const url = URL.createObjectURL(blob)
      v.playsInline = true
      v.muted = true
      v.preload = 'auto'
      v.src = url
      const ok = await new Promise<boolean>((resolve) => {
        v.onloadedmetadata = () => resolve(true)
        v.onerror = () => resolve(false)
        setTimeout(() => resolve(v.readyState >= 1), 8000)
      })
      if (!ok || !Number.isFinite(v.duration) || v.duration <= 0) {
        URL.revokeObjectURL(url)
        continue
      }
      this.tracks.push({ v, url, start: at, dur: v.duration })
      at += v.duration - XF
    }
    // ilk klibin ilk karesi hazır olsun
    const first = this.tracks[0]?.v
    if (first && first.readyState < 2) {
      await new Promise<void>((resolve) => {
        first.addEventListener('loadeddata', () => resolve(), { once: true })
        setTimeout(resolve, 4000)
      })
    }
  }

  /** Oynatmadan önce çağrılır: klip sesinin nereye gideceği. */
  setAudio(mode: ClipAudio) {
    for (const tr of this.tracks) {
      tr.v.muted = mode === 'mute'
      if (typeof mode === 'object') {
        try {
          const src = mode.ctx.createMediaElementSource(tr.v)
          src.connect(mode.out)
          this.sources.push(src)
        } catch {
          tr.v.muted = true
        }
      }
    }
  }

  prefetch(_t: number) {}

  dispose() {
    for (const tr of this.tracks) {
      tr.v.pause()
      tr.v.removeAttribute('src')
      tr.v.load()
      URL.revokeObjectURL(tr.url)
    }
    for (const s of this.sources) s.disconnect()
    this.tracks = []
    this.sources = []
  }

  /** Videoyu filmin saatiyle eşler: zamanı gelince oynatır, kayarsa düzeltir, bitince durdurur. */
  private sync(tr: Track, t: number) {
    const local = t - tr.start
    const v = tr.v
    if (local < 0 || local >= tr.dur) {
      if (!v.paused) v.pause()
      if (local < 0 && v.currentTime > 0.05 && v.readyState >= 1) v.currentTime = 0
      return
    }
    if (Math.abs(v.currentTime - local) > 0.35) v.currentTime = local
    if (v.paused && !v.ended) {
      v.play().catch(() => {
        // sesli oynatma engellenirse sessiz devam et
        if (!v.muted) {
          v.muted = true
          void v.play().catch(() => {})
        }
      })
    }
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    for (const tr of this.tracks) this.sync(tr, t)
    const last = this.tracks[this.tracks.length - 1]
    const outroAt = last ? last.start + last.dur - 1.5 : INTRO
    ctx.save()
    ctx.fillStyle = '#0e0616'
    ctx.fillRect(0, 0, FW, FH)

    // klipler (geçişte iki klip üst üste)
    for (let i = 0; i < this.tracks.length; i++) {
      const tr = this.tracks[i]
      const local = t - tr.start
      const isLast = i === this.tracks.length - 1
      if (local < 0 || (!isLast && local > tr.dur)) continue
      const a = smooth(local / XF)
      if (a <= 0) continue
      ctx.globalAlpha = a
      this.frame(ctx, tr.v, t, 1 - smooth((t - outroAt) / 0.8))
    }
    ctx.globalAlpha = 1

    if (t < INTRO) this.intro(ctx, t)
    if (t >= outroAt) this.outro(ctx, t - outroAt, !!last)
    ctx.restore()
  }

  private frame(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, t: number, labels: number) {
    if (v.readyState < 2 || !v.videoWidth) return
    const vw = v.videoWidth
    const vh = v.videoHeight
    if (this.input.fit === 'kirp') {
      const k = Math.max(FW / vw, FH / vh)
      ctx.drawImage(v, (FW - vw * k) / 2, (FH - vh * k) / 2, vw * k, vh * k)
      return
    }
    // sığdır: bulanık arka plan + ortada tam video
    const s = this.soft.getContext('2d')!
    const kb = Math.max(this.soft.width / vw, this.soft.height / vh)
    s.drawImage(v, (this.soft.width - vw * kb) / 2, (this.soft.height - vh * kb) / 2, vw * kb, vh * kb)
    const m = this.mid.getContext('2d')!
    m.imageSmoothingEnabled = true
    m.drawImage(this.soft, 0, 0, this.mid.width, this.mid.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.mid, -30, -30, FW + 60, FH + 60)
    const base = ctx.globalAlpha
    ctx.globalAlpha = base * 0.45
    ctx.fillStyle = '#0e0616'
    ctx.fillRect(0, 0, FW, FH)
    ctx.globalAlpha = base
    const k = Math.min(FW / vw, FH / vh)
    const dw = vw * k
    const dh = vh * k
    const y = (FH - dh) / 2
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 40
    ctx.drawImage(v, (FW - dw) / 2, y, dw, dh)
    ctx.shadowBlur = 0

    // üstte isimler, altta gün sayısı (yatay videolarda boş alana)
    if (dh < FH * 0.8 && labels > 0) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = base * 0.92 * labels
      ctx.fillStyle = '#ffe3ea'
      ctx.font = `500 46px ${SERIF}`
      ctx.fillText(`${this.input.b} & ${this.input.a}`, FW / 2, y / 2)
      ctx.font = `italic 400 34px ${SERIF}`
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`${this.days.toLocaleString('tr-TR')} gündür birlikte`, FW / 2, FH - y / 2)
      const beat = 1 + 0.05 * Math.max(0, Math.sin(t * 6.5))
      this.heartAt(ctx, FW / 2, y / 2 + 52, 22 * beat, '#ff7fa5', base * 0.9 * labels)
      ctx.globalAlpha = base
    }
  }

  private heartAt(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x - size / 2, y - size / 2)
    ctx.scale(size / 24, size / 24)
    ctx.fillStyle = color
    ctx.fill(this.heart)
    ctx.restore()
  }

  private intro(ctx: CanvasRenderingContext2D, t: number) {
    const fade = 1 - smooth((t - (INTRO - XF)) / XF)
    ctx.save()
    ctx.globalAlpha = fade
    const g = ctx.createLinearGradient(0, 0, 0, FH)
    g.addColorStop(0, '#3a1c52')
    g.addColorStop(1, '#0e0616')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, FW, FH)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = fade * smooth(t / 0.8)
    ctx.fillStyle = '#ffe3ea'
    ctx.font = `500 62px ${SERIF}`
    ctx.fillText(`${this.input.b} & ${this.input.a}`, FW / 2, 420)
    const beat = 1 + 0.04 * Math.max(0, Math.sin(t * 6.5))
    this.heartAt(ctx, FW / 2, 620, 300 * beat, '#ff7fa5', fade * 0.85 * smooth((t - 0.2) / 0.8))
    ctx.globalAlpha = fade * smooth((t - 0.4) / 0.8)
    ctx.fillStyle = '#fff'
    ctx.font = `300 110px ${SERIF}`
    ctx.fillText(Math.round(this.days * smooth((t - 0.4) / 1.6)).toLocaleString('tr-TR'), FW / 2, 600)
    ctx.font = `italic 400 40px ${SERIF}`
    ctx.fillText('gün', FW / 2, 690)
    ctx.restore()
  }

  private outro(ctx: CanvasRenderingContext2D, u: number, overClip: boolean) {
    ctx.save()
    const a = smooth(u / 1.6)
    if (!overClip) {
      ctx.fillStyle = '#0e0616'
      ctx.fillRect(0, 0, FW, FH)
    }
    const v = ctx.createRadialGradient(FW / 2, FH * 0.6, FH * 0.1, FW / 2, FH * 0.55, FH * 0.75)
    v.addColorStop(0, `rgba(14,6,22,${0.45 * a})`)
    v.addColorStop(1, `rgba(14,6,22,${0.9 * a})`)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, FW, FH)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const ta = smooth((u - 0.5) / 0.9)
    const beat = 1 + 0.04 * Math.max(0, Math.sin(u * 6.5))
    this.heartAt(ctx, FW / 2, 470, 250 * beat, '#ff7fa5', ta * 0.9)
    ctx.globalAlpha = ta
    ctx.fillStyle = '#fff'
    ctx.font = `300 92px ${SERIF}`
    ctx.fillText(this.days.toLocaleString('tr-TR'), FW / 2, 455)
    ctx.font = `italic 400 34px ${SERIF}`
    ctx.fillText('gün', FW / 2, 530)
    ctx.globalAlpha = ta * smooth((u - 1.1) / 0.8)
    ctx.fillStyle = '#ffe3ea'
    ctx.font = `500 58px ${SERIF}`
    ctx.fillText(`${this.input.b} & ${this.input.a}`, FW / 2, 680)
    ctx.font = `italic 400 38px ${SERIF}`
    ctx.fillText('Daha çok anımız olacak.', FW / 2, 750)
    ctx.restore()
  }
}
