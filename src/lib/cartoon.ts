import { daysBetween, parseISO } from './time'
import { drawPerson, HEART_PATH } from './cartoon-people'

export const CW = 720
export const CH = 1280
export const CARTOON_SECONDS = 32

const TAU = Math.PI * 2
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
const rand = (k: number) => {
  const v = Math.sin(k * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}
const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (r: number[]) => '#' + r.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const mixHex = (a: string, b: string, t: number) => {
  const A = hex(a)
  const B = hex(b)
  return toHex(A.map((v, i) => lerp(v, B[i], t)))
}

interface Sky {
  top: string
  mid: string
  bot: string
  sea: string
  sand: string
  night: number
}

const SKY: [number, Sky][] = [
  [0, { top: '#6b4f9a', mid: '#ff8c69', bot: '#ffd28c', sea: '#e58f72', sand: '#f0cc9d', night: 0 }],
  [9, { top: '#5a4694', mid: '#ff7f6e', bot: '#ffc27f', sea: '#d4806f', sand: '#e8bf92', night: 0.08 }],
  [18, { top: '#33296a', mid: '#cf5a8a', bot: '#ff9a78', sea: '#8d5183', sand: '#c39b7e', night: 0.4 }],
  [23, { top: '#0e1236', mid: '#1c2362', bot: '#3d4189', sea: '#1d2858', sand: '#6b6579', night: 0.85 }],
  [40, { top: '#0b0e2e', mid: '#171d57', bot: '#343a80', sea: '#18224f', sand: '#5f5a70', night: 1 }],
]

function skyAt(t: number): Sky {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [t0, a] = SKY[i]
    const [t1, b] = SKY[i + 1]
    if (t >= t0 && t <= t1) {
      const k = smooth((t - t0) / (t1 - t0))
      return {
        top: mixHex(a.top, b.top, k),
        mid: mixHex(a.mid, b.mid, k),
        bot: mixHex(a.bot, b.bot, k),
        sea: mixHex(a.sea, b.sea, k),
        sand: mixHex(a.sand, b.sand, k),
        night: lerp(a.night, b.night, k),
      }
    }
  }
  return SKY[SKY.length - 1][1]
}

function heart(ctx: CanvasRenderingContext2D, path: Path2D, x: number, y: number, size: number, color: string, alpha: number, rot = 0) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(size / 24, size / 24)
  ctx.translate(-12, -12)
  ctx.fillStyle = color
  ctx.fill(path)
  ctx.restore()
}

export interface CartoonInput {
  a: string
  b: string
  start: string
}

/** Adem ve Sena'nın çizgi film hikâyesi: sahil, yürüyüş, balıkçıda akşam yemeği. */
export class Cartoon {
  readonly duration = CARTOON_SECONDS
  readonly n = 3
  private heartPath = new Path2D(HEART_PATH)
  private days: number
  private input: CartoonInput

  constructor(input: CartoonInput) {
    this.input = input
    this.days = Math.max(0, daysBetween(parseISO(input.start), new Date()))
  }

  async prepare() {}
  prefetch(_t: number) {
    void _t
  }
  dispose() {}

  draw(ctx: CanvasRenderingContext2D, t: number) {
    t = Math.min(t, CARTOON_SECONDS - 0.001)
    if (t < 9.6) {
      this.beach(ctx, t)
      if (t > 8.9) {
        ctx.globalAlpha = smooth((t - 8.9) / 0.7)
        this.walk(ctx, 9 + (t - 8.9))
        ctx.globalAlpha = 1
      }
    } else if (t < 18.6) {
      this.walk(ctx, t)
      if (t > 17.9) {
        ctx.globalAlpha = smooth((t - 17.9) / 0.7)
        this.dinner(ctx, 18 + (t - 17.9))
        ctx.globalAlpha = 1
      }
    } else if (t < 28.8) {
      this.dinner(ctx, t)
      if (t > 28.1) {
        ctx.globalAlpha = smooth((t - 28.1) / 0.7)
        this.endCard(ctx, t)
        ctx.globalAlpha = 1
      }
    } else this.endCard(ctx, t)
  }

  // ---------- ortak arka plan ----------
  private backdrop(ctx: CanvasRenderingContext2D, t: number, horizon: number, sunBoost = 0) {
    const sky = skyAt(t)
    const g = ctx.createLinearGradient(0, 0, 0, horizon)
    g.addColorStop(0, sky.top)
    g.addColorStop(0.55, sky.mid)
    g.addColorStop(1, sky.bot)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, CW, horizon + 2)

    // yıldızlar
    if (sky.night > 0.35) {
      for (let i = 0; i < 46; i++) {
        const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + rand(i) * 2) + i)
        ctx.globalAlpha = clamp01((sky.night - 0.35) / 0.5) * (0.35 + 0.65 * tw)
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(rand(i * 2 + 1) * CW, rand(i * 3 + 2) * horizon * 0.8, 0.8 + rand(i + 9) * 1.6, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // güneş: ufka doğru iner
    const sunY = horizon - 120 + smooth(t / 22) * 230 + sunBoost
    const sunX = 470
    if (sunY < horizon + 90) {
      const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 330)
      glow.addColorStop(0, 'rgba(255,230,160,0.75)')
      glow.addColorStop(0.35, 'rgba(255,170,110,0.28)')
      glow.addColorStop(1, 'rgba(255,140,100,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, CW, horizon + 4)
      ctx.fillStyle = '#fff1c2'
      ctx.beginPath()
      ctx.arc(sunX, sunY, 66, 0, TAU)
      ctx.fill()
    }
    // ay
    const moon = clamp01((t - 19) / 3)
    if (moon > 0) {
      const mx = 150
      const my = horizon * 0.45
      const mg = ctx.createRadialGradient(mx, my, 6, mx, my, 120)
      mg.addColorStop(0, `rgba(255,246,216,${0.5 * moon})`)
      mg.addColorStop(1, 'rgba(255,246,216,0)')
      ctx.fillStyle = mg
      ctx.fillRect(mx - 130, my - 130, 260, 260)
      ctx.globalAlpha = moon
      ctx.fillStyle = '#fff6d8'
      ctx.beginPath()
      ctx.arc(mx, my, 40, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#e8dfb8'
      for (const [dx, dy, r] of [[-12, -8, 8], [10, 12, 6], [8, -16, 4]]) {
        ctx.beginPath()
        ctx.arc(mx + dx, my + dy, r, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // bulutlar
    for (let i = 0; i < 4; i++) {
      const x = ((t * (8 + i * 3) + i * 230) % (CW + 360)) - 180
      const y = 110 + i * 62 + rand(i) * 30
      ctx.fillStyle = mixHex('#ffd8c0', '#9a8fc0', sky.night)
      ctx.globalAlpha = 0.55 * (1 - sky.night * 0.5)
      for (const [dx, dy, r] of [[0, 0, 34], [38, -10, 42], [82, 2, 32], [40, 14, 36]]) {
        ctx.beginPath()
        ctx.arc(x + dx, y + dy, r, 0, TAU)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // martılar
    if (sky.night < 0.5) {
      ctx.strokeStyle = 'rgba(60,40,70,0.75)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (let i = 0; i < 3; i++) {
        const x = ((t * (34 + i * 12) + i * 260) % (CW + 200)) - 100
        const y = 190 + i * 70 + Math.sin(t * 1.4 + i) * 14
        const f = Math.sin(t * 7 + i * 2) * 11
        ctx.beginPath()
        ctx.moveTo(x - 22, y + f * 0.6)
        ctx.quadraticCurveTo(x - 10, y - 10 - f, x, y)
        ctx.quadraticCurveTo(x + 10, y - 10 - f, x + 22, y + f * 0.6)
        ctx.stroke()
      }
    }

    // deniz
    const sg = ctx.createLinearGradient(0, horizon, 0, horizon + 420)
    sg.addColorStop(0, mixHex(sky.sea, sky.bot, 0.35))
    sg.addColorStop(1, mixHex(sky.sea, '#1b1740', 0.45))
    ctx.fillStyle = sg
    ctx.fillRect(0, horizon, CW, CH - horizon)
    // güneş yansıması
    const refl = clamp01(1 - (t - 14) / 9) * (1 - sky.night)
    if (refl > 0) {
      for (let r = 0; r < 16; r++) {
        const y = horizon + 10 + r * (9 + r * 1.3)
        const w = 18 + r * 11 + Math.sin(t * 2 + r) * 8
        ctx.fillStyle = `rgba(255,226,160,${0.5 * refl * (1 - r / 17)})`
        ctx.fillRect(470 - w / 2 + Math.sin(t * 1.3 + r * 1.7) * 10, y, w, 3 + r * 0.25)
      }
    }
    // dalgalar
    for (let k = 0; k < 6; k++) {
      const y0 = horizon + 22 + k * k * 4 + k * 26
      const amp = 3 + k * 1.4
      const len = 110 + k * 34
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + k * 0.025})`
      ctx.lineWidth = 2 + k * 0.4
      ctx.beginPath()
      for (let x = -10; x <= CW + 10; x += 10) {
        const y = y0 + Math.sin((x / len) * TAU + t * (0.8 + k * 0.15) + k) * amp
        if (x === -10) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return sky
  }

  private hearts(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, from: number, to: number, every: number, color = '#ff7fa5') {
    for (let i = 0; ; i++) {
      const s = from + i * every
      if (s > to) break
      const u = (t - s) / 2.6
      if (u < 0 || u > 1) continue
      const size = 20 + rand(i * 5 + from) * 16
      heart(ctx, this.heartPath, x + Math.sin(u * 6 + i) * 24 + (rand(i + from) - 0.5) * 60, y - u * 240, size, i % 3 === 0 ? '#b9a2f5' : color, Math.sin(u * Math.PI) * 0.9, Math.sin(u * 4 + i) * 0.3)
    }
  }

  private caption(ctx: CanvasRenderingContext2D, text: string, local: number, dur: number, y = 150) {
    const a = smooth(local / 0.8) * smooth((dur - local) / 0.8)
    if (a <= 0) return
    ctx.save()
    ctx.globalAlpha = a
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = "italic 400 46px Fraunces, 'Iowan Old Style', Georgia, serif"
    ctx.shadowColor = 'rgba(20,8,30,0.6)'
    ctx.shadowBlur = 14
    ctx.fillStyle = '#fff'
    ctx.fillText(text, CW / 2, y + (1 - a) * 12)
    ctx.restore()
  }

  // ---------- 1. sahil: yan yana oturuyorlar ----------
  private beach(ctx: CanvasRenderingContext2D, t: number) {
    const H0 = CH * 0.5
    const sky = this.backdrop(ctx, t, H0)
    // kumsal
    const sandTop = CH * 0.7
    const sg = ctx.createLinearGradient(0, sandTop, 0, CH)
    sg.addColorStop(0, mixHex(sky.sand, '#ffffff', 0.15))
    sg.addColorStop(1, mixHex(sky.sand, '#b88a5f', 0.5))
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.moveTo(0, sandTop + 10)
    for (let x = 0; x <= CW; x += 12) ctx.lineTo(x, sandTop + Math.sin(x / 90 + t * 0.9) * 7 + Math.sin(x / 37 - t * 1.4) * 3)
    ctx.lineTo(CW, CH)
    ctx.lineTo(0, CH)
    ctx.fill()
    // köpük çizgisi
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 6
    ctx.beginPath()
    for (let x = 0; x <= CW; x += 12) {
      const y = sandTop + Math.sin(x / 90 + t * 0.9) * 7 + Math.sin(x / 37 - t * 1.4) * 3 - 4
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // kumsal örtüsü
    ctx.fillStyle = '#e8657a'
    ctx.beginPath()
    ctx.ellipse(360, 1100, 340, 74, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath()
      ctx.ellipse(360 + i * 70, 1100, 13, 72, 0, 0, TAU)
      ctx.fill()
    }

    // yengeç
    const cx = ((t * 24) % 900) - 120
    this.crab(ctx, cx, 1200, t)

    // karakterler
    const glance = smooth((t - 3.4) / 0.5) * smooth((5.6 - t) / 0.5)
    const lean = smooth((t - 6) / 1.4)
    const handJoin = { x: 367, y: 1032 }
    drawPerson(ctx, {
      who: 'adem', x: 246, y: 1102, s: 1.28, pose: 'sit', t, look: glance * 0.9 + (1 - glance) * 0.15, tilt: 0.04 + lean * 0.08,
      mouth: 0.12 + 0.35 * smooth((t - 6.6) / 0.4) * smooth((8.8 - t) / 0.4), inner: 1, handA: handJoin, squint: lean * 0.55,
    })
    drawPerson(ctx, {
      who: 'sena', x: 474, y: 1102, s: 1.24, pose: 'sit', t, look: -glance * 0.9 - (1 - glance) * 0.1, tilt: -0.05 - lean * 0.2,
      mouth: 0.1 + 0.3 * smooth((t - 6.6) / 0.4) * smooth((8.8 - t) / 0.4), inner: -1, handA: handJoin, hx: -lean * 34, squint: lean * 0.6,
    })
    this.hearts(ctx, t, 360, 850, 4.8, 9.6, 0.7)
    this.caption(ctx, 'Sahilde, yan yana...', t, 9.2)
    this.dim(ctx, sky.night)
  }

  private crab(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    const sc = 1
    ctx.save()
    ctx.translate(x, y + Math.sin(t * 9) * 1.5)
    ctx.scale(sc, sc)
    ctx.strokeStyle = '#d4503c'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const ph = Math.sin(t * 14 + k * 1.3 + (sd > 0 ? 0 : 1.5)) * 4
        ctx.beginPath()
        ctx.moveTo(sd * 14, 4 + k * 3)
        ctx.lineTo(sd * (26 + k * 3), 10 + k * 3 + ph)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(sd * 20, -4)
      ctx.lineTo(sd * 34, -18 + Math.sin(t * 6) * 3)
      ctx.stroke()
      ctx.fillStyle = '#e8624a'
      ctx.beginPath()
      ctx.arc(sd * 36, -22 + Math.sin(t * 6) * 3, 8, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = '#e8624a'
    ctx.beginPath()
    ctx.ellipse(0, 0, 24, 15, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#fff'
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(sd * 8, -14, 4, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.arc(sd * 8, -14, 1.8, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#fff'
    }
    ctx.restore()
  }

  /** Akşama doğru karakterlerin ve ön planın üstüne ılık-mor ton. */
  private dim(ctx: CanvasRenderingContext2D, night: number) {
    if (night <= 0.02) return
    ctx.fillStyle = `rgba(30,24,80,${0.38 * night})`
    ctx.fillRect(0, 0, CW, CH)
  }

  // ---------- 2. yürüyüş ----------
  private walk(ctx: CanvasRenderingContext2D, t: number) {
    const H0 = CH * 0.5
    const sky = this.backdrop(ctx, t, H0)
    const w = (t - 9) * 96
    // uzak tepeler (yavaş kayar)
    ctx.fillStyle = mixHex('#7a4a7e', '#1c1840', sky.night)
    ctx.beginPath()
    ctx.moveTo(0, H0 + 6)
    for (let x = 0; x <= CW; x += 12) ctx.lineTo(x, H0 - 30 - Math.sin((x + w * 0.12) / 140) * 24 - Math.sin((x + w * 0.12) / 53) * 8)
    ctx.lineTo(CW, H0 + 6)
    ctx.fill()
    // deniz fenerli kayık
    const bx = ((CW + 200 - (t * 22) % (CW + 400)) % (CW + 400)) - 100
    this.boat(ctx, bx, H0 + 52, 0.8, sky.night)

    // kumsal
    const sandTop = CH * 0.66
    const sg = ctx.createLinearGradient(0, sandTop, 0, CH)
    sg.addColorStop(0, mixHex(sky.sand, '#ffffff', 0.12))
    sg.addColorStop(1, mixHex(sky.sand, '#a97b50', 0.5))
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.moveTo(0, sandTop + 10)
    for (let x = 0; x <= CW; x += 12) ctx.lineTo(x, sandTop + Math.sin((x + w * 0.6) / 90) * 8)
    ctx.lineTo(CW, CH)
    ctx.lineTo(0, CH)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 6
    ctx.beginPath()
    for (let x = 0; x <= CW; x += 12) {
      const y = sandTop + Math.sin((x + w * 0.6) / 90) * 8 - 4 + Math.sin(t * 1.2 + x / 60) * 2
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // palmiyeler ve şemsiye (kayan ön plan)
    const tile = 1500
    const objs: [number, string][] = [[200, 'palm'], [720, 'umbrella'], [1100, 'palm'], [1380, 'rock']]
    for (const [ox, kind] of objs) {
      const x = ((((ox - w * 0.75) % tile) + tile) % tile) - 200
      if (kind === 'palm') this.palm(ctx, x, sandTop + 40, 1, t, sky.night)
      else if (kind === 'umbrella') this.umbrella(ctx, x, sandTop + 130, sky.night)
      else {
        ctx.fillStyle = mixHex('#8d7a6d', '#3b3350', sky.night)
        ctx.beginPath()
        ctx.ellipse(x, sandTop + 150, 46, 26, 0, 0, TAU)
        ctx.fill()
      }
    }

    // ayak izleri
    const charWorld = w + 340
    for (let k = 0; k < 40; k++) {
      const wx = charWorld - 60 - k * 54
      const sx = wx - w
      if (sx < -40) break
      if (sx > CW) continue
      const age = k * 54
      ctx.fillStyle = `rgba(110,80,50,${Math.max(0, 0.32 - age / 900)})`
      for (const [dy, off] of [[1118, 0], [1066, 27]] as const) {
        ctx.beginPath()
        ctx.ellipse(sx + off, dy + (k % 2) * 8, 11, 5, 0, 0, TAU)
        ctx.fill()
      }
    }

    // karakterler: ele ele yürüyorlar
    const ph = t * 6.4
    const hold = { x: 348, y: 900 }
    const lookAt = Math.sin(t * 0.8) * 0.2
    drawPerson(ctx, {
      who: 'adem', x: 262, y: 1056, s: 1.06, pose: 'walk', t, ph, look: 0.55 + lookAt, tilt: 0.02, mouth: 0.15, handB: hold,
    })
    drawPerson(ctx, {
      who: 'sena', x: 438, y: 1108, s: 1.1, pose: 'walk', t, ph: ph + 0.5, look: -0.45, tilt: -0.05, mouth: 0.15 + 0.4 * smooth(Math.sin(t * 1.3) * 3), handA: hold,
    })
    this.hearts(ctx, t, 350, 800, 11, 17.5, 1.1)
    this.caption(ctx, 'Sonra kıyıda yürüyüş...', t - 9, 9.2)
    this.dim(ctx, sky.night)
  }

  private boat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, night: number) {
    ctx.save()
    ctx.translate(x, y + Math.sin(x / 40) * 3)
    ctx.scale(s, s)
    ctx.fillStyle = mixHex('#5a3a4a', '#1a1630', night)
    ctx.beginPath()
    ctx.moveTo(-50, 0)
    ctx.lineTo(50, 0)
    ctx.lineTo(36, 22)
    ctx.lineTo(-36, 22)
    ctx.fill()
    ctx.fillStyle = mixHex('#fff1e0', '#b7b3d6', night)
    ctx.beginPath()
    ctx.moveTo(0, -78)
    ctx.lineTo(0, -4)
    ctx.lineTo(38, -4)
    ctx.fill()
    ctx.strokeStyle = '#3b2b36'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, -82)
    ctx.lineTo(0, 0)
    ctx.stroke()
    ctx.restore()
  }

  private palm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, night: number) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.strokeStyle = mixHex('#7a5538', '#2b2036', night)
    ctx.lineWidth = 16
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 130)
    ctx.quadraticCurveTo(26, 20, 10, -120)
    ctx.stroke()
    ctx.strokeStyle = mixHex('#3f8a55', '#1b3a45', night)
    ctx.lineWidth = 12
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.62 + Math.sin(t * 1.2 + i) * 0.04
      ctx.beginPath()
      ctx.moveTo(10, -120)
      ctx.quadraticCurveTo(10 + Math.cos(a) * 60, -120 + Math.sin(a) * 40 - 20, 10 + Math.cos(a) * 110, -120 + Math.sin(a) * 70 + 34)
      ctx.stroke()
    }
    ctx.restore()
  }

  private umbrella(ctx: CanvasRenderingContext2D, x: number, y: number, night: number) {
    ctx.strokeStyle = mixHex('#8a6a50', '#30263d', night)
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 10, y - 180)
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? mixHex('#ffffff', '#6d6a96', night) : mixHex('#ec5b6c', '#5a2b55', night)
      ctx.beginPath()
      ctx.moveTo(x - 10, y - 190)
      ctx.arc(x - 10, y - 160, 90, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6)
      ctx.closePath()
      ctx.fill()
    }
  }

  // ---------- 3. balıkçıda akşam yemeği ----------
  private dinner(ctx: CanvasRenderingContext2D, t: number) {
    const d = t - 18
    const H0 = CH * 0.4
    const sky = this.backdrop(ctx, t, H0, 40)
    // karşı kıyının ışıkları
    ctx.fillStyle = mixHex('#40315c', '#10142e', sky.night)
    ctx.beginPath()
    ctx.moveTo(0, H0 + 4)
    for (let x = 0; x <= CW; x += 12) ctx.lineTo(x, H0 - 24 - Math.sin(x / 120) * 14)
    ctx.lineTo(CW, H0 + 4)
    ctx.fill()
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(255,214,130,${0.5 + 0.4 * Math.sin(t * 2 + i)})`
      ctx.fillRect(rand(i) * CW, H0 - 18 + rand(i + 4) * 14, 3, 3)
    }
    // kayık ışığıyla
    const bx = ((t * 14 + 120) % (CW + 300)) - 150
    this.boat(ctx, bx, H0 + 74, 0.7, sky.night)
    ctx.fillStyle = `rgba(255,214,130,${0.6 + 0.3 * Math.sin(t * 5)})`
    ctx.beginPath()
    ctx.arc(bx, H0 + 40, 5, 0, TAU)
    ctx.fill()
    // atlayan balık
    const jt = (t * 0.35) % 1
    if (jt < 0.2) {
      const u = jt / 0.2
      ctx.save()
      ctx.translate(560 - u * 120, H0 + 120 - Math.sin(u * Math.PI) * 90)
      ctx.rotate(-1 + u * 2)
      ctx.fillStyle = '#c9d6e0'
      ctx.beginPath()
      ctx.ellipse(0, 0, 20, 8, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-18, 0)
      ctx.lineTo(-32, -9)
      ctx.lineTo(-32, 9)
      ctx.fill()
      ctx.restore()
    }

    // iskele zemini
    const deckTop = CH * 0.64
    const dg = ctx.createLinearGradient(0, deckTop, 0, CH)
    dg.addColorStop(0, '#7a5638')
    dg.addColorStop(1, '#4b3425')
    ctx.fillStyle = dg
    ctx.fillRect(0, deckTop, CW, CH - deckTop)
    ctx.strokeStyle = 'rgba(25,14,8,0.5)'
    ctx.lineWidth = 3
    for (let i = 0; i < 9; i++) {
      const y = deckTop + 8 + i * i * 4.2 + i * 14
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CW, y)
      ctx.stroke()
    }
    // korkuluk
    ctx.fillStyle = '#5a3f2a'
    ctx.fillRect(0, deckTop - 6, CW, 12)
    for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 140, deckTop - 70, 12, 70)
    ctx.fillRect(0, deckTop - 64, CW, 8)

    // ışık zinciri
    const bulbs = 12
    for (let s = 0; s < 2; s++) {
      const y0 = 78 + s * 54
      for (let i = 0; i <= bulbs; i++) {
        const u = i / bulbs
        const x = u * CW
        const y = y0 + Math.sin(u * Math.PI) * 54
        if (i > 0) {
          const pu = (i - 1) / bulbs
          ctx.strokeStyle = 'rgba(30,20,20,0.7)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(pu * CW, y0 + Math.sin(pu * Math.PI) * 54)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        const fl = 0.75 + 0.25 * Math.sin(t * 3 + i * 1.7 + s)
        const gl = ctx.createRadialGradient(x, y + 8, 1, x, y + 8, 30)
        gl.addColorStop(0, `rgba(255,214,130,${0.55 * fl * sky.night})`)
        gl.addColorStop(1, 'rgba(255,214,130,0)')
        ctx.fillStyle = gl
        ctx.fillRect(x - 32, y - 24, 64, 64)
        ctx.fillStyle = `rgba(255,232,160,${0.5 + 0.5 * fl})`
        ctx.beginPath()
        ctx.arc(x, y + 8, 6, 0, TAU)
        ctx.fill()
      }
    }
    // tabela
    ctx.save()
    ctx.translate(550, 118)
    ctx.rotate(-0.05 + Math.sin(t * 1.3) * 0.015)
    ctx.fillStyle = '#6d4a2e'
    ctx.fillRect(-120, -26, 240, 52)
    ctx.strokeStyle = '#f0d9a8'
    ctx.lineWidth = 3
    ctx.strokeRect(-114, -20, 228, 40)
    ctx.fillStyle = '#ffe6a8'
    ctx.font = "700 30px Figtree, system-ui, sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('BALIKÇI', 0, 2)
    ctx.restore()

    // masa üstü yüzeyi (karakterlerden önce)
    const tableTop = 1030
    ctx.fillStyle = '#f2ece0'
    ctx.beginPath()
    ctx.moveTo(70, tableTop + 30)
    ctx.lineTo(130, tableTop)
    ctx.lineTo(590, tableTop)
    ctx.lineTo(650, tableTop + 30)
    ctx.closePath()
    ctx.fill()

    // karakterler
    const eat1 = this.eatCycle(d, 0)
    const eat2 = this.eatCycle(d, 0.9)
    const cheers = smooth((d - 4.4) / 0.6) * smooth((6.6 - d) / 0.5)
    const clink = d > 5.4 && d < 5.9
    const kiss = smooth((d - 7) / 0.8) * smooth((10.4 - d) / 0.6)
    const plateA = { x: 262, y: 1022 }
    const plateS = { x: 458, y: 1022 }
    const mouthA = { x: 258, y: 896 }
    const mouthS = { x: 462, y: 900 }
    const glassPos = { x: 366, y: 884 }
    const forkA = {
      x: lerp(lerp(plateA.x, mouthA.x, eat1.reach), glassPos.x - 14, cheers),
      y: lerp(lerp(plateA.y, mouthA.y, eat1.reach), glassPos.y, cheers),
    }
    const forkS = {
      x: lerp(lerp(plateS.x, mouthS.x, eat2.reach), glassPos.x + 14, cheers),
      y: lerp(lerp(plateS.y, mouthS.y, eat2.reach), glassPos.y, cheers),
    }
    drawPerson(ctx, {
      who: 'adem', x: 250, y: 1090, s: 1.22, pose: 'dine', t, look: 0.35 + cheers * 0.2, tilt: 0.03 + kiss * 0.12, nod: eat1.chew * 2,
      mouth: Math.max(eat1.mouth * (1 - cheers), cheers * 0.4, kiss * 0.5), inner: 1, handA: forkA, handB: { x: 190, y: 1018 }, squint: kiss * 0.6, hx: kiss * 10,
    })
    drawPerson(ctx, {
      who: 'sena', x: 470, y: 1090, s: 1.2, pose: 'dine', t, look: -0.35 - cheers * 0.2, tilt: -0.03 - kiss * 0.22, nod: eat2.chew * 2,
      mouth: Math.max(eat2.mouth * (1 - cheers), cheers * 0.4, kiss * 0.4), inner: -1, handA: forkS, handB: { x: 530, y: 1018 }, squint: kiss * 0.7, hx: -kiss * 112,
    })

    // masa önü örtüsü
    const clothTop = 1058
    ctx.fillStyle = '#f2ece0'
    ctx.fillRect(70, clothTop, 580, CH - clothTop)
    ctx.save()
    ctx.beginPath()
    ctx.rect(70, clothTop, 580, CH - clothTop)
    ctx.clip()
    ctx.fillStyle = '#d8463f'
    const sq = 46
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 13; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(70 + c * sq, clothTop + r * sq, sq, sq)
      }
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(70, clothTop, 580, 8)

    // tabaklar ve balıklar
    this.plate(ctx, plateA.x, 1074, clamp01((d - 1.2) / 3.6) + clamp01((d - 6.8) / 2.5) * 0.6)
    this.plate(ctx, plateS.x, 1074, clamp01((d - 1.9) / 3.6) + clamp01((d - 6.8) / 2.5) * 0.6)
    // mum
    ctx.fillStyle = '#f5ede0'
    ctx.fillRect(352, 1030, 16, 44)
    const fl = 0.8 + 0.2 * Math.sin(t * 11)
    const cg = ctx.createRadialGradient(360, 1018, 2, 360, 1018, 70)
    cg.addColorStop(0, `rgba(255,200,110,${0.55 * fl})`)
    cg.addColorStop(1, 'rgba(255,200,110,0)')
    ctx.fillStyle = cg
    ctx.fillRect(280, 950, 160, 140)
    ctx.fillStyle = '#ffd36a'
    ctx.beginPath()
    ctx.ellipse(360, 1018, 6, 12 * fl, 0, 0, TAU)
    ctx.fill()

    // çatal ve bardaklar
    for (const [h, who] of [[forkA, 0], [forkS, 1]] as const) {
      if (cheers > 0.05) {
        this.glass(ctx, h.x, h.y, cheers)
      } else {
        ctx.strokeStyle = '#d7dbe0'
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(h.x, h.y)
        ctx.lineTo(h.x + (who ? -22 : 22), h.y - 36)
        ctx.stroke()
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(h.x + (who ? -22 : 22), h.y - 36)
        ctx.lineTo(h.x + (who ? -24 : 24), h.y - 52)
        ctx.stroke()
      }
    }
    if (clink) {
      const u = (d - 5.4) / 0.5
      ctx.strokeStyle = `rgba(255,240,180,${1 - u})`
      ctx.lineWidth = 3
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU
        ctx.beginPath()
        ctx.moveTo(366 + Math.cos(a) * (14 + u * 6), 866 + Math.sin(a) * (14 + u * 6))
        ctx.lineTo(366 + Math.cos(a) * (26 + u * 30), 866 + Math.sin(a) * (26 + u * 30))
        ctx.stroke()
      }
    }
    this.hearts(ctx, t, 330, 800, 25.4, 28.6, 0.5)
    this.hearts(ctx, t, 330, 840, 19.5, 22, 1.2, '#ffb0c8')
    this.caption(ctx, 'Akşam da balıkçıda balık...', d, 10.4, 330)
    ctx.fillStyle = `rgba(20,10,40,${0.18 * (1 - sky.night)})`
    ctx.fillRect(0, 0, CW, CH)
  }

  private eatCycle(d: number, offset: number) {
    const per = 2.4
    const k = ((d + offset) % per) / per
    const bite = d > 1 && d < 4.2 ? 1 : 0
    const reach = bite * smooth(Math.sin(k * TAU - Math.PI / 2) * 0.5 + 0.5)
    const atMouth = reach > 0.8 ? 1 : 0
    const chew = bite && k > 0.55 && k < 0.95 ? Math.sin(d * 22) * 0.5 + 0.5 : 0
    return { reach, mouth: atMouth * 0.7 + chew * 0.35, chew }
  }

  private plate(ctx: CanvasRenderingContext2D, x: number, y: number, eaten: number) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(x, y, 112, 26, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#d6d9de'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(x, y, 88, 18, 0, 0, TAU)
    ctx.stroke()
    const e = clamp01(eaten)
    // limon
    ctx.fillStyle = '#ffe36a'
    ctx.beginPath()
    ctx.ellipse(x + 78, y - 2, 18, 8, 0, 0, TAU)
    ctx.fill()
    // yeşillik
    ctx.fillStyle = '#58a45a'
    ctx.beginPath()
    ctx.ellipse(x - 80, y, 20, 8, 0, 0, TAU)
    ctx.fill()
    // balık
    const body = Math.max(0.12, 1 - e * 0.9)
    ctx.save()
    ctx.translate(x - 4, y - 4)
    ctx.fillStyle = '#c3d1da'
    ctx.beginPath()
    ctx.moveTo(-70, 0)
    ctx.bezierCurveTo(-40, -24 * body, 30, -22 * body, 62, -2)
    ctx.bezierCurveTo(30, 20 * body, -40, 22 * body, -70, 0)
    ctx.fill()
    ctx.fillStyle = '#a9bcc8'
    ctx.beginPath()
    ctx.moveTo(60, -2)
    ctx.lineTo(86, -18)
    ctx.lineTo(86, 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(70,60,60,0.45)'
    ctx.lineWidth = 3
    for (let i = -1; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(i * 22 - 12, -14 * body)
      ctx.lineTo(i * 22 + 6, 14 * body)
      ctx.stroke()
    }
    ctx.fillStyle = '#222'
    ctx.beginPath()
    ctx.arc(-54, -4, 3.2, 0, TAU)
    ctx.fill()
    if (e > 0.45) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.globalAlpha = clamp01((e - 0.45) / 0.3)
      ctx.beginPath()
      ctx.moveTo(-50, 0)
      ctx.lineTo(60, 0)
      ctx.stroke()
      for (let i = 0; i < 7; i++) {
        ctx.beginPath()
        ctx.moveTo(-40 + i * 14, 0)
        ctx.lineTo(-34 + i * 14, -13)
        ctx.moveTo(-40 + i * 14, 0)
        ctx.lineTo(-34 + i * 14, 13)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  private glass(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(x, y - 6)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.moveTo(-16, -26)
    ctx.lineTo(16, -26)
    ctx.lineTo(11, 20)
    ctx.lineTo(-11, 20)
    ctx.fill()
    ctx.fillStyle = '#ffc93c'
    ctx.beginPath()
    ctx.moveTo(-14, -12)
    ctx.lineTo(14, -12)
    ctx.lineTo(10, 18)
    ctx.lineTo(-10, 18)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-16, -26)
    ctx.lineTo(-11, 20)
    ctx.moveTo(16, -26)
    ctx.lineTo(11, 20)
    ctx.stroke()
    ctx.restore()
  }

  // ---------- kapanış ----------
  private endCard(ctx: CanvasRenderingContext2D, t: number) {
    const u = t - 28.2
    const g = ctx.createLinearGradient(0, 0, 0, CH)
    g.addColorStop(0, '#2a1440')
    g.addColorStop(1, '#0e0616')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, CW, CH)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const a = smooth(u / 0.9)
    ctx.globalAlpha = a
    const beat = 1 + 0.04 * Math.max(0, Math.sin(t * 6.5))
    heart(ctx, this.heartPath, CW / 2, 470, 300 * beat, '#ff7fa5', 0.9)
    ctx.fillStyle = '#fff'
    ctx.font = "300 120px Fraunces, 'Iowan Old Style', Georgia, serif"
    ctx.fillText(this.days.toLocaleString('tr-TR'), CW / 2, 450)
    ctx.font = "italic 400 40px Fraunces, 'Iowan Old Style', Georgia, serif"
    ctx.fillText('gün', CW / 2, 548)
    ctx.globalAlpha = a * smooth((u - 0.7) / 0.8)
    ctx.fillStyle = '#ffe3ea'
    ctx.font = "500 64px Fraunces, 'Iowan Old Style', Georgia, serif"
    ctx.fillText(`${this.input.b} & ${this.input.a}`, CW / 2, 820)
    ctx.font = "italic 400 44px Fraunces, 'Iowan Old Style', Georgia, serif"
    ctx.fillText('Daha çok anımız olacak.', CW / 2, 910)
    ctx.globalAlpha = 1
    this.hearts(ctx, t, 360, 760, 28.4, 32, 0.45)
  }
}
