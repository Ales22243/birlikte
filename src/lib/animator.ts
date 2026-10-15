import { decode, type Decoded } from '../data/photos'
import { daysBetween, formatLong, parseISO } from './time'

export const W = 720
export const H = 1280
export const SCENE = 3.2
export const FADE = 0.9
export const INTRO = 3.6
export const OUTRO = 3.4

export interface Timing {
  intro: number
  scene: number
  fade: number
  outro: number
}

export const DEFAULT_TIMING: Timing = { intro: INTRO, scene: SCENE, fade: FADE, outro: OUTRO }

export type Length = 'kisa5' | 'kisa8' | 'kisa10' | 'uzun'

/** Kısa filmlerde açılış yok; her fotoğraf kısa kalır, hedef süreye sığacak kadar fotoğraf alınır. */
export function planFor(length: Length, available: number, wanted: number): { timing: Timing; count: number } {
  if (length === 'uzun') return { timing: DEFAULT_TIMING, count: wanted === 0 ? available : Math.min(wanted, available) }
  const target = length === 'kisa5' ? 5 : length === 'kisa8' ? 8 : 10
  const scene = length === 'kisa5' ? 1.6 : 2
  const outro = length === 'kisa5' ? 1.8 : length === 'kisa8' ? 1.8 : 2
  const timing: Timing = { intro: 0, scene, fade: 0.5, outro }
  return { timing, count: Math.min(available, Math.max(1, Math.round((target - outro) / scene))) }
}

/** Hem fotoğraflı film hem çizgi film bu arayüzle oynatılır ve kaydedilir. */
export interface FrameSource {
  readonly duration: number
  prepare(): Promise<void>
  prefetch(t: number): void
  draw(ctx: CanvasRenderingContext2D, t: number): void
  dispose(): void
}

export type AnimStyle = 'karisik' | 'yakin' | 'polaroid'

export interface AnimPhoto {
  blob: Blob
  takenAt: string
  caption: string
}

export interface AnimInput {
  photos: AnimPhoto[]
  a: string
  b: string
  start: string
  style: AnimStyle
  timing?: Timing
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)
const easeInOut = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
const easeOutBack = (x: number) => {
  const c1 = 1.3
  const t = clamp01(x)
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const rand = (k: number) => {
  const v = Math.sin(k * 127.1) * 43758.5453
  return v - Math.floor(v)
}

interface Move {
  s0: number
  s1: number
  x0: number
  x1: number
  y0: number
  y1: number
}
// Ana ekrandaki KenBurns hareketleriyle aynı (yüzde olarak kayma)
const MOVES: Move[] = [
  { s0: 1, s1: 1.16, x0: 0, x1: -2, y0: 0, y1: -2 },
  { s0: 1.16, s1: 1, x0: 2, x1: 0, y0: 1, y1: 0 },
  { s0: 1.12, s1: 1.12, x0: -4, x1: 4, y0: 0, y1: 0 },
  { s0: 1.12, s1: 1.12, x0: 4, x1: -4, y0: 1, y1: -1 },
  { s0: 1.1, s1: 1.14, x0: 0, x1: 0, y0: 3, y1: -3 },
]

const SERIF = "Fraunces, 'Iowan Old Style', Georgia, serif"
const SANS = "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (cur && ctx.measureText(next).width > maxWidth) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

/** Fotoğrafları kare kare tuvale çizen, zamanın saf bir fonksiyonu olan animasyon. */
export class Animator {
  readonly n: number
  readonly duration: number
  private cache = new Map<number, Decoded>()
  private pending = new Map<number, Promise<void>>()
  private failed = new Set<number>()
  private blur = new Map<number, HTMLCanvasElement>()
  private days: number
  private heart = new Path2D('M12 21.2C5.2 16 2.6 12.4 2.6 8.6 2.6 5.8 4.8 3.6 7.5 3.6c1.8 0 3.5 1 4.5 2.6 1-1.6 2.7-2.6 4.5-2.6 2.7 0 4.9 2.2 4.9 5 0 3.8-2.6 7.4-9.4 12.6z')

  private input: AnimInput
  private T: Timing

  constructor(input: AnimInput) {
    this.input = input
    this.T = input.timing ?? DEFAULT_TIMING
    this.n = input.photos.length
    this.duration = this.T.intro + this.n * this.T.scene + this.T.outro
    this.days = Math.max(0, daysBetween(parseISO(input.start), new Date()))
  }

  private load(i: number): Promise<void> {
    if (i < 0 || i >= this.n || this.cache.has(i) || this.failed.has(i)) return Promise.resolve()
    const existing = this.pending.get(i)
    if (existing) return existing
    const p = decode(this.input.photos[i].blob)
      .then((d) => {
        this.cache.set(i, d)
        this.makeBlur(i, d)
      })
      .catch(() => void this.failed.add(i))
      .finally(() => void this.pending.delete(i))
    this.pending.set(i, p)
    return p
  }

  private makeBlur(i: number, d: Decoded) {
    const c = document.createElement('canvas')
    c.width = 27
    c.height = 48
    const x = c.getContext('2d')!
    const k = Math.max(c.width / d.width, c.height / d.height)
    x.drawImage(d.source, (c.width - d.width * k) / 2, (c.height - d.height * k) / 2, d.width * k, d.height * k)
    this.blur.set(i, c)
  }

  async prepare() {
    await Promise.all([this.load(0), this.load(1)])
  }

  /** Şu an k. sahnedeyiz: yakındakileri hazırla, uzaktakilerin belleğini bırak. */
  prefetch(t: number) {
    const k = Math.floor((t - this.T.intro) / this.T.scene)
    for (const j of [k, k + 1, k + 2]) void this.load(j)
    for (const [idx, d] of this.cache) {
      if (idx < k - 1 || idx > k + 3) {
        d.release()
        this.cache.delete(idx)
        this.blur.delete(idx)
      }
    }
  }

  dispose() {
    for (const d of this.cache.values()) d.release()
    this.cache.clear()
    this.blur.clear()
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    if (this.T.intro > 0 && t < this.T.intro) {
      this.drawIntro(ctx, t, 1)
    } else {
      const s = t - this.T.intro
      const k = Math.floor(s / this.T.scene)
      if (k >= this.n) {
        const u = s - this.n * this.T.scene
        if (u < this.T.fade && this.n > 0) {
          this.drawScene(ctx, this.n - 1, this.T.scene + u, 1)
          this.drawOutro(ctx, u, easeInOut(u / this.T.fade))
        } else this.drawOutro(ctx, u, 1)
      } else {
        const local = s - k * this.T.scene
        if (local < this.T.fade) {
          if (k === 0 && this.T.intro === 0) {
            this.drawScene(ctx, k, local, 1)
          } else {
            if (k === 0) this.drawIntro(ctx, this.T.intro, 1)
            else this.drawScene(ctx, k - 1, this.T.scene + local, 1)
            this.drawScene(ctx, k, local, easeInOut(local / this.T.fade))
          }
        } else this.drawScene(ctx, k, local, 1)
      }
    }
    this.drawHearts(ctx, t)
  }

  private background(ctx: CanvasRenderingContext2D, from = '#3a1d57', to = '#140a20') {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, from)
    g.addColorStop(1, to)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    const r = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, W * 0.9)
    r.addColorStop(0, 'rgba(255,127,165,0.28)')
    r.addColorStop(1, 'rgba(255,127,165,0)')
    ctx.fillStyle = r
    ctx.fillRect(0, 0, W, H)
  }

  private drawIntro(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
    ctx.save()
    ctx.globalAlpha = alpha
    this.background(ctx)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffe3ea'
    ctx.globalAlpha = alpha * easeOut(t / 0.9)
    ctx.font = `500 62px ${SERIF}`
    ctx.fillText(`${this.input.a} & ${this.input.b}`, W / 2, 210)

    // Atan kalp
    const beat = 1 + 0.035 * Math.max(0, Math.sin(t * 6.5)) + 0.05 * easeOut(t / 1.2)
    const sc = 17.5 * beat
    ctx.save()
    ctx.translate(W / 2 - 12 * sc, 560 - 12 * sc)
    ctx.scale(sc, sc)
    const hg = ctx.createLinearGradient(0, 0, 24, 24)
    hg.addColorStop(0, 'rgba(255,127,165,0.55)')
    hg.addColorStop(1, 'rgba(185,162,245,0.35)')
    ctx.fillStyle = hg
    ctx.fill(this.heart)
    ctx.lineWidth = 3.2 / sc
    ctx.strokeStyle = '#ff7fa5'
    ctx.stroke(this.heart)
    ctx.restore()

    ctx.globalAlpha = alpha * easeOut((t - 0.4) / 0.8)
    ctx.fillStyle = '#fff'
    ctx.font = `300 150px ${SERIF}`
    const count = Math.round(this.days * easeOut((t - 0.5) / 2.4))
    ctx.fillText(count.toLocaleString('tr-TR'), W / 2, 540)
    ctx.font = `italic 400 44px ${SERIF}`
    ctx.fillStyle = '#ffe3ea'
    ctx.fillText('gün', W / 2, 640)

    ctx.globalAlpha = alpha * easeOut((t - 1.4) / 0.9)
    ctx.font = `italic 400 56px ${SERIF}`
    ctx.fillText('gündür birlikteyiz', W / 2, 900)
    ctx.restore()
  }

  private drawOutro(ctx: CanvasRenderingContext2D, u: number, alpha: number) {
    ctx.save()
    ctx.globalAlpha = alpha
    this.background(ctx, '#2a1440', '#0e0616')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = alpha * easeOut((u - 0.2) / 0.9)
    ctx.font = `300 84px ${SERIF}`
    const lines = wrapLines(ctx, 'Daha çok anımız olacak.', W - 140)
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 560 + i * 100))
    ctx.globalAlpha = alpha * easeOut((u - 0.9) / 0.9)
    ctx.font = `500 44px ${SERIF}`
    ctx.fillStyle = '#ff9fbb'
    ctx.fillText(`${this.input.a} & ${this.input.b}`, W / 2, 560 + lines.length * 100 + 40)
    ctx.restore()
  }

  private drawScene(ctx: CanvasRenderingContext2D, i: number, local: number, alpha: number) {
    const d = this.cache.get(i)
    ctx.save()
    ctx.globalAlpha = alpha
    if (!d) {
      this.background(ctx)
      ctx.restore()
      return
    }
    const style = this.input.style
    const polaroid = style === 'polaroid' || (style === 'karisik' && i % 3 === 2)
    if (polaroid) this.photoPolaroid(ctx, i, d, local)
    else this.photoKenBurns(ctx, i, d, local)
    this.caption(ctx, i, local, !polaroid)
    ctx.restore()
  }

  private photoKenBurns(ctx: CanvasRenderingContext2D, i: number, d: Decoded, local: number) {
    const m = MOVES[i % MOVES.length]
    const p = clamp01(local / (this.T.scene + this.T.fade))
    const s = lerp(m.s0, m.s1, p)
    const cover = Math.max(W / d.width, H / d.height) * s
    const dw = d.width * cover
    const dh = d.height * cover
    const x = (lerp(m.x0, m.x1, p) * W) / 100
    const y = (lerp(m.y0, m.y1, p) * H) / 100
    ctx.drawImage(d.source, W / 2 - dw / 2 + x, H / 2 - dh / 2 + y, dw, dh)
  }

  private photoPolaroid(ctx: CanvasRenderingContext2D, i: number, d: Decoded, local: number) {
    const b = this.blur.get(i)
    if (b) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(b, 0, 0, W, H)
    } else this.background(ctx)
    ctx.fillStyle = 'rgba(20,8,30,0.5)'
    ctx.fillRect(0, 0, W, H)

    const e = easeOutBack(local / 1.2)
    const tilt = (i % 2 ? 1 : -1) * 0.07
    const cw = W * 0.78
    const pad = 26
    const pw = cw - pad * 2
    const ph = pw * 1.08
    const ch = ph + pad + 100
    ctx.save()
    ctx.globalAlpha *= clamp01(local / 0.5)
    ctx.translate(W / 2, H * 0.4 + (1 - Math.min(e, 1.2)) * H * 0.55)
    ctx.rotate(tilt * (0.2 + (1 - clamp01(e)) * 2.6))
    const sc = 0.85 + 0.15 * Math.min(e, 1)
    ctx.scale(sc, sc)
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 16
    ctx.fillStyle = '#fffdf8'
    roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 8)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.save()
    roundRect(ctx, -pw / 2, -ch / 2 + pad, pw, ph, 3)
    ctx.clip()
    const z = 1 + 0.06 * clamp01(local / (this.T.scene + this.T.fade))
    const cover = Math.max(pw / d.width, ph / d.height) * z
    const dw = d.width * cover
    const dh = d.height * cover
    ctx.drawImage(d.source, -dw / 2, -ch / 2 + pad + ph / 2 - dh / 2, dw, dh)
    ctx.restore()
    ctx.restore()
  }

  private caption(ctx: CanvasRenderingContext2D, i: number, local: number, scrim: boolean) {
    const p = this.input.photos[i]
    const date = parseISO(p.takenAt)
    const dayNo = daysBetween(parseISO(this.input.start), date) + 1
    const a = easeOut((local - 0.5) / 0.7)
    if (scrim) {
      const g = ctx.createLinearGradient(0, H * 0.58, 0, H)
      g.addColorStop(0, 'rgba(14,6,22,0)')
      g.addColorStop(1, 'rgba(14,6,22,0.78)')
      ctx.fillStyle = g
      ctx.fillRect(0, H * 0.58, W, H * 0.42)
    }
    ctx.save()
    ctx.globalAlpha *= a
    ctx.translate(0, (1 - a) * 18)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#fff'
    if (dayNo >= 1) {
      ctx.font = `300 112px ${SERIF}`
      ctx.fillText(`${dayNo}. gün`, 56, H - 200)
    }
    ctx.font = `500 34px ${SANS}`
    ctx.fillText(formatLong(date), 58, H - 142)
    if (p.caption) {
      ctx.font = `italic 400 40px ${SERIF}`
      ctx.fillText(fitText(ctx, p.caption, W - 116), 58, H - 84)
    }
    ctx.restore()
  }

  private drawHearts(ctx: CanvasRenderingContext2D, t: number) {
    for (let j = 0; j < 12; j++) {
      const r1 = rand(j * 3 + 1)
      const r2 = rand(j * 3 + 2)
      const r3 = rand(j * 3 + 3)
      const size = 20 + r1 * 26
      const speed = 70 + r3 * 90
      const y = H + 60 - ((t * speed + r1 * H * 1.7) % (H + 160))
      const x = r2 * W + Math.sin(t * 0.8 + j) * 18
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.translate(x - size / 2, y - size / 2)
      ctx.scale(size / 24, size / 24)
      ctx.fillStyle = j % 3 === 0 ? '#b9a2f5' : '#ff7fa5'
      ctx.fill(this.heart)
      ctx.restore()
    }
  }
}

const CANDIDATES: [string, string][] = [
  ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'webm'],
  ['video/webm;codecs=vp8,opus', 'webm'],
  ['video/webm', 'webm'],
]

export function pickRecorderFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const [mime, ext] of CANDIDATES) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  return null
}
