import { daysBetween, parseISO } from './time'
import { drawPerson, HEART_PATH } from './cartoon-people'

export const CW = 720
export const CH = 1280
export const CARTOON_SECONDS = 47

const TAU = Math.PI * 2
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
/** 0 → 1 → 0 zarfı: a'da başlar, b'de biter. */
const pulse = (t: number, a: number, b: number, fade = 0.5) => smooth((t - a) / fade) * smooth((b - t) / fade)
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
  [12, { top: '#5d4a95', mid: '#ff7d6c', bot: '#ffc07c', sea: '#d8806e', sand: '#e9c093', night: 0.06 }],
  [24, { top: '#3b2d70', mid: '#d4608a', bot: '#ff9a78', sea: '#955584', sand: '#c79f80', night: 0.35 }],
  [32, { top: '#0e1236', mid: '#1c2362', bot: '#3d4189', sea: '#1d2858', sand: '#6b6579', night: 0.85 }],
  [60, { top: '#0b0e2e', mid: '#171d57', bot: '#343a80', sea: '#18224f', sand: '#5f5a70', night: 1 }],
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

function heartAt(ctx: CanvasRenderingContext2D, path: Path2D, x: number, y: number, size: number, color: string, alpha: number, rot = 0) {
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

interface SceneDef {
  s: number
  e: number
  draw: (ctx: CanvasRenderingContext2D, t: number) => void
}

const FONT_SERIF = "Fraunces, 'Iowan Old Style', Georgia, serif"
const FONT_SANS = "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif"

/** Adem ve Sena'nın çizgi film hikâyesi: şezlongda gün batımı, el ele yürüyüş, salaş balıkçıda dürüm ve kahkaha. */
export class Cartoon {
  readonly duration = CARTOON_SECONDS
  readonly n = 4
  private heartPath = new Path2D(HEART_PATH)
  private days: number
  private input: CartoonInput
  private scenes: SceneDef[]

  constructor(input: CartoonInput) {
    this.input = input
    this.days = Math.max(0, daysBetween(parseISO(input.start), new Date()))
    this.scenes = [
      { s: 0, e: 12.6, draw: (c, t) => this.chairs(c, t) },
      { s: 11.4, e: 27.8, draw: (c, t) => this.walk(c, t) },
      { s: 26.6, e: 44.4, draw: (c, t) => this.shack(c, t) },
      { s: 43.2, e: 47, draw: (c, t) => this.endCard(c, t) },
    ]
  }

  async prepare() {}
  prefetch(_t: number) {
    void _t
  }
  dispose() {}

  draw(ctx: CanvasRenderingContext2D, t: number) {
    t = Math.min(t, CARTOON_SECONDS - 0.001)
    let k = 0
    for (let i = 0; i < this.scenes.length; i++) if (t >= this.scenes[i].s) k = i
    const cur = this.scenes[k]
    const FADE = 1.2
    if (k > 0 && t < cur.s + FADE) {
      // Eski sahne akmaya devam ederken yenisi yumuşakça belirir; kesme yok.
      this.scenes[k - 1].draw(ctx, t)
      ctx.globalAlpha = smooth((t - cur.s) / FADE)
      cur.draw(ctx, t)
      ctx.globalAlpha = 1
      // sıcak ışık sızıntısı
      const leak = Math.sin(clamp01((t - cur.s) / FADE) * Math.PI)
      ctx.fillStyle = `rgba(255,205,150,${0.2 * leak})`
      ctx.fillRect(0, 0, CW, CH)
    } else cur.draw(ctx, t)
    this.film(ctx, t)
  }

  /** Sinema havası: vinyet, hafif tane ve çok hafif kamera sallanması bu katmanda. */
  private film(ctx: CanvasRenderingContext2D, t: number) {
    const v = ctx.createRadialGradient(CW / 2, CH * 0.52, CH * 0.3, CW / 2, CH * 0.52, CH * 0.82)
    v.addColorStop(0, 'rgba(10,4,20,0)')
    v.addColorStop(1, 'rgba(10,4,20,0.42)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, CW, CH)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    const seed = Math.floor(t * 24)
    for (let i = 0; i < 160; i++) {
      ctx.fillRect(rand(seed * 7 + i) * CW, rand(seed * 13 + i * 3) * CH, 2, 2)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    for (let i = 0; i < 120; i++) {
      ctx.fillRect(rand(seed * 5 + i + 400) * CW, rand(seed * 11 + i * 2 + 800) * CH, 2, 2)
    }
  }

  private cam(ctx: CanvasRenderingContext2D, local: number, dur: number, fx: number, fy: number, z0: number, z1: number, pan = 0) {
    const k = smooth(local / dur)
    const z = lerp(z0, z1, k)
    ctx.translate(fx + pan * (k - 0.5), fy)
    ctx.scale(z, z)
    ctx.translate(-fx, -fy)
  }

  // ---------- ortak arka plan ----------
  private backdrop(ctx: CanvasRenderingContext2D, t: number, horizon: number, sunBoost = 0, sunX = 470) {
    const sky = skyAt(t)
    const g = ctx.createLinearGradient(0, 0, 0, horizon)
    g.addColorStop(0, sky.top)
    g.addColorStop(0.55, sky.mid)
    g.addColorStop(1, sky.bot)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, CW, horizon + 2)

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

    const sunY = horizon - 120 + smooth(t / 32) * 240 + sunBoost
    if (sunY < horizon + 90) {
      const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 340)
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
    const moon = clamp01((t - 28) / 3)
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

    for (let i = 0; i < 4; i++) {
      const x = ((t * (8 + i * 3) + i * 230) % (CW + 360)) - 180
      const y = 100 + i * 58 + rand(i) * 30
      ctx.fillStyle = mixHex('#ffd8c0', '#9a8fc0', sky.night)
      ctx.globalAlpha = 0.55 * (1 - sky.night * 0.5)
      for (const [dx, dy, r] of [[0, 0, 34], [38, -10, 42], [82, 2, 32], [40, 14, 36]]) {
        ctx.beginPath()
        ctx.arc(x + dx, y + dy, r, 0, TAU)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    if (sky.night < 0.5) {
      ctx.strokeStyle = 'rgba(60,40,70,0.75)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (let i = 0; i < 3; i++) {
        const x = ((t * (34 + i * 12) + i * 260) % (CW + 200)) - 100
        const y = 170 + i * 66 + Math.sin(t * 1.4 + i) * 14
        const f = Math.sin(t * 7 + i * 2) * 11
        ctx.beginPath()
        ctx.moveTo(x - 22, y + f * 0.6)
        ctx.quadraticCurveTo(x - 10, y - 10 - f, x, y)
        ctx.quadraticCurveTo(x + 10, y - 10 - f, x + 22, y + f * 0.6)
        ctx.stroke()
      }
    }

    const sg = ctx.createLinearGradient(0, horizon, 0, horizon + 420)
    sg.addColorStop(0, mixHex(sky.sea, sky.bot, 0.35))
    sg.addColorStop(1, mixHex(sky.sea, '#1b1740', 0.45))
    ctx.fillStyle = sg
    ctx.fillRect(0, horizon, CW, CH - horizon)
    const refl = clamp01(1 - (t - 18) / 10) * (1 - sky.night)
    if (refl > 0) {
      for (let r = 0; r < 16; r++) {
        const y = horizon + 10 + r * (9 + r * 1.3)
        const w = 18 + r * 11 + Math.sin(t * 2 + r) * 8
        ctx.fillStyle = `rgba(255,226,160,${0.5 * refl * (1 - r / 17)})`
        ctx.fillRect(sunX - w / 2 + Math.sin(t * 1.3 + r * 1.7) * 10, y, w, 3 + r * 0.25)
      }
    }
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

  private sand(ctx: CanvasRenderingContext2D, sky: Sky, top: number, t: number, scroll = 0) {
    const sg = ctx.createLinearGradient(0, top, 0, CH)
    sg.addColorStop(0, mixHex(sky.sand, '#ffffff', 0.14))
    sg.addColorStop(1, mixHex(sky.sand, '#a97b50', 0.5))
    ctx.fillStyle = sg
    const edge = (x: number) => top + Math.sin((x + scroll) / 90 + t * 0.9) * 7 + Math.sin((x + scroll) / 37 - t * 1.4) * 3
    ctx.beginPath()
    ctx.moveTo(0, edge(0))
    for (let x = 12; x <= CW; x += 12) ctx.lineTo(x, edge(x))
    ctx.lineTo(CW, CH)
    ctx.lineTo(0, CH)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.82)'
    ctx.lineWidth = 6
    ctx.beginPath()
    for (let x = 0; x <= CW; x += 12) {
      if (x === 0) ctx.moveTo(x, edge(x) - 4)
      else ctx.lineTo(x, edge(x) - 4)
    }
    ctx.stroke()
    // ıslak kum parıltısı
    ctx.fillStyle = `rgba(255,236,200,${0.18 * (1 - sky.night)})`
    ctx.beginPath()
    ctx.moveTo(0, edge(0))
    for (let x = 12; x <= CW; x += 12) ctx.lineTo(x, edge(x) + 18)
    for (let x = CW; x >= 0; x -= 12) ctx.lineTo(x, edge(x))
    ctx.fill()
  }

  private hearts(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, from: number, to: number, every: number, color = '#ff7fa5') {
    for (let i = 0; ; i++) {
      const s = from + i * every
      if (s > to) break
      const u = (t - s) / 2.6
      if (u < 0 || u > 1) continue
      const size = 20 + rand(i * 5 + from) * 16
      heartAt(ctx, this.heartPath, x + Math.sin(u * 6 + i) * 24 + (rand(i + from) - 0.5) * 60, y - u * 240, size, i % 3 === 0 ? '#b9a2f5' : color, Math.sin(u * Math.PI) * 0.9, Math.sin(u * 4 + i) * 0.3)
    }
  }

  private caption(ctx: CanvasRenderingContext2D, text: string, t: number, a: number, b: number, y = 150) {
    const k = pulse(t, a, b, 0.8)
    if (k <= 0) return
    ctx.save()
    ctx.globalAlpha = k
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let fs = 46
    ctx.font = `italic 400 ${fs}px ${FONT_SERIF}`
    while (ctx.measureText(text).width > CW - 70 && fs > 24) {
      fs -= 2
      ctx.font = `italic 400 ${fs}px ${FONT_SERIF}`
    }
    ctx.shadowColor = 'rgba(20,8,30,0.6)'
    ctx.shadowBlur = 14
    ctx.fillStyle = '#fff'
    ctx.fillText(text, CW / 2, y + (1 - k) * 12)
    ctx.restore()
  }

  /** Konuşma balonu: pop animasyonuyla belirir. */
  private bubble(ctx: CanvasRenderingContext2D, text: string, t: number, a: number, b: number, x: number, y: number, tx: number, ty: number, color = '#ffffff', size = 32) {
    const k = pulse(t, a, b, 0.25)
    if (k <= 0) return
    const pop = 0.7 + 0.3 * Math.min(1, k * 1.2) + Math.sin(clamp01((t - a) / 0.4) * Math.PI) * 0.08
    ctx.save()
    ctx.globalAlpha = Math.min(1, k * 1.5)
    ctx.translate(x, y)
    ctx.scale(pop, pop)
    ctx.font = `700 ${size}px ${FONT_SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const w = ctx.measureText(text).width + 44
    const h = size + 34
    ctx.fillStyle = color
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(-w / 2 + 22, -h / 2)
    ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, 22)
    ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, 22)
    ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, 22)
    ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, 22)
    ctx.closePath()
    ctx.fill()
    // kuyruk: kısa, konuşana doğru
    const dx = tx - x
    const dy = ty - y
    const down = dy > 0
    const bx = Math.max(-w / 2 + 40, Math.min(w / 2 - 40, dx * 0.3))
    const edge = down ? h / 2 : -h / 2
    ctx.beginPath()
    ctx.moveTo(bx - 14, edge - (down ? 2 : -2))
    ctx.lineTo(bx + Math.max(-34, Math.min(34, dx * 0.12)), edge + (down ? 46 : -46))
    ctx.lineTo(bx + 14, edge - (down ? 2 : -2))
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#2a1a33'
    ctx.fillText(text, 0, 2)
    ctx.restore()
  }

  // ---------- 1. şezlonglarda, denize bakarak ----------
  private chairs(ctx: CanvasRenderingContext2D, t: number) {
    const H0 = CH * 0.43
    ctx.save()
    this.cam(ctx, t, 12.6, 360, 900, 1, 1.1)
    const sky = this.backdrop(ctx, t, H0, 0, 440)
    // uzakta yelkenli
    this.boat(ctx, 130 + t * 4, H0 + 40, 0.7, sky.night)
    this.sand(ctx, sky, CH * 0.6, t)

    // yengeç
    this.crab(ctx, ((t * 20) % 900) - 120, 1230, t)

    const turnA = smooth((t - 4.8) / 1.2)
    const turnS = smooth((t - 4.4) / 1.2)
    const laugh = pulse(t, 8.2, 10.2, 0.4)
    const hold = { x: 360, y: 1066 }
    // masa
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(360, 1215, 76, 14, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#7a5538'
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(360, 1110)
    ctx.lineTo(360, 1210)
    ctx.stroke()
    ctx.fillStyle = '#9b6e47'
    ctx.beginPath()
    ctx.ellipse(360, 1108, 64, 14, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#b98557'
    ctx.beginPath()
    ctx.ellipse(360, 1103, 64, 14, 0, 0, TAU)
    ctx.fill()
    for (const dx of [-26, 24]) this.teaGlass(ctx, 360 + dx, 1096, t)

    drawPerson(ctx, {
      who: 'adem', x: 212, y: 1196, s: 1.4, pose: 'chair', t, look: 0.9, tilt: 0.1 * turnA, turn: turnA,
      mouth: 0.15 + 0.5 * laugh, joy: laugh * 0.4, inner: 1, handA: hold, bounce: Math.sin(t * 16) * 2 * laugh,
    })
    drawPerson(ctx, {
      who: 'sena', x: 508, y: 1196, s: 1.38, pose: 'chair', t, look: -0.9, tilt: -0.1 * turnS, turn: turnS,
      mouth: 0.15 + 0.5 * laugh, joy: laugh * 0.4, inner: -1, handA: hold, bounce: Math.sin(t * 16 + 1) * 2 * laugh,
    })
    this.chairBack(ctx, 212, '#2f7fb8')
    this.chairBack(ctx, 508, '#e2566b')
    // terlikler
    ctx.fillStyle = '#4aa3c8'
    for (const [x, y] of [[150, 1262], [262, 1266]]) {
      ctx.beginPath()
      ctx.ellipse(x, y, 30, 11, 0.1, 0, TAU)
      ctx.fill()
    }

    ctx.restore()
    this.hearts(ctx, t, 360, 900, 6.6, 12, 0.8)
    this.bubble(ctx, 'Yürüyelim mi?', t, 9.2, 11.6, 190, 735, 215, 800)
    this.bubble(ctx, 'Olur, hadi!', t, 10.2, 12.2, 520, 690, 505, 800, '#ffe3ef')
    this.caption(ctx, 'Gün batarken, yan yana...', t, 0.2, 5.6)
  }

  private chairBack(ctx: CanvasRenderingContext2D, x: number, color: string) {
    const top = 1034
    const w = 230
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.ellipse(x, 1284, w / 2 + 10, 14, 0, 0, TAU)
    ctx.fill()
    // bez yüzey
    ctx.beginPath()
    ctx.moveTo(x - w / 2, top + 30)
    ctx.quadraticCurveTo(x - w / 2, top, x - w / 2 + 34, top)
    ctx.lineTo(x + w / 2 - 34, top)
    ctx.quadraticCurveTo(x + w / 2, top, x + w / 2, top + 30)
    ctx.lineTo(x + w / 2, 1290)
    ctx.lineTo(x - w / 2, 1290)
    ctx.closePath()
    ctx.clip()
    ctx.fillStyle = '#fff7e8'
    ctx.fillRect(x - w / 2, top, w, 260)
    ctx.fillStyle = color
    for (let i = 0; i < 9; i++) ctx.fillRect(x - w / 2 + i * 52 - 6, top, 26, 260)
    const shade = ctx.createLinearGradient(0, top, 0, 1290)
    shade.addColorStop(0, 'rgba(255,255,255,0.12)')
    shade.addColorStop(1, 'rgba(0,0,0,0.14)')
    ctx.fillStyle = shade
    ctx.fillRect(x - w / 2, top, w, 260)
    ctx.restore()
    // tahta çerçeve
    ctx.fillStyle = '#8a5a35'
    ctx.fillRect(x - w / 2 - 8, top + 10, 12, 260)
    ctx.fillRect(x + w / 2 - 4, top + 10, 12, 260)
    ctx.fillStyle = '#9a6a42'
    ctx.beginPath()
    ctx.roundRect?.(x - w / 2 - 8, top - 6, w + 16, 16, 8)
    if (!ctx.roundRect) ctx.rect(x - w / 2 - 8, top - 6, w + 16, 16)
    ctx.fill()
  }

  private teaGlass(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.moveTo(x - 12, y - 34)
    ctx.quadraticCurveTo(x - 7, y - 10, x - 8, y)
    ctx.lineTo(x + 8, y)
    ctx.quadraticCurveTo(x + 7, y - 10, x + 12, y - 34)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#c0501e'
    ctx.beginPath()
    ctx.moveTo(x - 10, y - 26)
    ctx.lineTo(x + 10, y - 26)
    ctx.quadraticCurveTo(x + 6, y - 8, x + 7, y)
    ctx.lineTo(x - 7, y)
    ctx.quadraticCurveTo(x - 6, y - 8, x - 10, y - 26)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    for (let i = 0; i < 2; i++) {
      const u = (t * 0.6 + i * 0.5) % 1
      ctx.globalAlpha = (1 - u) * 0.6
      ctx.beginPath()
      ctx.moveTo(x + (i ? 4 : -4) + Math.sin(u * 6) * 4, y - 40 - u * 30)
      ctx.quadraticCurveTo(x + (i ? 10 : -10), y - 52 - u * 30, x + (i ? 2 : -2) + Math.sin(u * 6 + 1) * 5, y - 64 - u * 30)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private crab(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    ctx.save()
    ctx.translate(x, y + Math.sin(t * 9) * 1.5)
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
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(sd * 8, -14, 4, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.arc(sd * 8, -14, 1.8, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  // ---------- 2. el ele yürüyüş ----------
  private walk(ctx: CanvasRenderingContext2D, t: number) {
    const local = t - 11.4
    const H0 = CH * 0.5
    ctx.save()
    this.cam(ctx, local, 16.4, 360, 960, 1.04, 1.0, 14)
    const sky = this.backdrop(ctx, t, H0)
    const w = (t - 11.4) * 98
    // uzak tepeler
    ctx.fillStyle = mixHex('#7a4a7e', '#1c1840', sky.night)
    ctx.beginPath()
    ctx.moveTo(0, H0 + 6)
    for (let x = 0; x <= CW; x += 12) ctx.lineTo(x, H0 - 30 - Math.sin((x + w * 0.12) / 140) * 24 - Math.sin((x + w * 0.12) / 53) * 8)
    ctx.lineTo(CW, H0 + 6)
    ctx.fill()
    const bx = ((CW + 200 - ((t * 22) % (CW + 400))) % (CW + 400)) - 100
    this.boat(ctx, bx, H0 + 52, 0.8, sky.night)

    const sandTop = CH * 0.66
    this.sand(ctx, sky, sandTop, t, w * 0.6)

    // kayan ön plan
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
    // sona doğru uzakta ışıklı balıkçı kulübesi yaklaşır
    const approach = smooth((local - 8) / 8)
    if (approach > 0) this.farShack(ctx, 900 - approach * 560, sandTop + 8, 0.55 + approach * 0.3, sky.night)

    // ayak izleri
    const charWorld = w + 340
    for (let k = 0; k < 40; k++) {
      const wx = charWorld - 60 - k * 54
      const sx = wx - w
      if (sx < -40) break
      if (sx > CW) continue
      ctx.fillStyle = `rgba(110,80,50,${Math.max(0, 0.32 - k * 54 / 900)})`
      for (const [dy, off] of [[1120, 0], [1070, 27]] as const) {
        ctx.beginPath()
        ctx.ellipse(sx + off, dy + (k % 2) * 8, 11, 5, 0, 0, TAU)
        ctx.fill()
      }
    }

    // el ele, birbirine bakarak, mutlu
    const ph = t * 6.2
    const hold = { x: 345, y: 888 }
    const glance = 0.75 + 0.25 * Math.sin(t * 0.9)
    const joyA = pulse(t, 18.6, 21.4, 0.6)
    drawPerson(ctx, {
      who: 'adem', x: 272, y: 1072, s: 1.2, pose: 'walk', t, ph, look: 0.95 * glance, tilt: 0.1, mouth: 0.25 + joyA * 0.7, joy: joyA, handB: hold, bounce: Math.sin(t * 15) * 2 * joyA,
    })
    drawPerson(ctx, {
      who: 'sena', x: 440, y: 1126, s: 1.24, pose: 'walk', t, ph: ph + 0.4, look: -0.95 * glance, tilt: -0.1, mouth: 0.25 + joyA * 0.7, joy: joyA, handA: hold, bounce: Math.sin(t * 15 + 1) * 2 * joyA,
    })
    ctx.restore()
    this.hearts(ctx, t, 350, 780, 13, 26, 1.0)
    this.bubble(ctx, 'Seninle her yer güzel', t, 15.4, 18.4, 360, 590, 345, 650, '#ffffff', 30)
    this.caption(ctx, 'El ele, kıyıda yürüyüş...', t, 12.4, 18.6)
  }

  private farShack(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, night: number) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.fillStyle = mixHex('#6b4a31', '#2a2030', night * 0.7)
    ctx.fillRect(-90, -150, 180, 150)
    ctx.fillStyle = mixHex('#8a8f94', '#3a3d55', night * 0.7)
    ctx.beginPath()
    ctx.moveTo(-110, -148)
    ctx.lineTo(110, -148)
    ctx.lineTo(96, -190)
    ctx.lineTo(-96, -190)
    ctx.fill()
    ctx.fillStyle = `rgba(255,210,120,${0.55 + 0.4 * night})`
    ctx.fillRect(-50, -110, 100, 60)
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = `rgba(255,228,150,${0.6 + 0.4 * Math.sin(i * 2 + night * 9)})`
      ctx.beginPath()
      ctx.arc(-90 + i * 30, -138, 5, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
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

  // ---------- 3. salaş balıkçıda dürüm ve kahkaha ----------
  private shack(ctx: CanvasRenderingContext2D, t: number) {
    const d = t - 26.6
    const H0 = CH * 0.4
    ctx.save()
    this.cam(ctx, d, 17.8, 360, 900, 1.0, 1.07)
    const sky = this.backdrop(ctx, t, H0, 40)
    // karşı kıyı
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
    // kayıklar ve fener yansımaları
    for (let i = 0; i < 2; i++) {
      const bx = ((t * (12 + i * 5) + 120 + i * 320) % (CW + 300)) - 150
      this.boat(ctx, bx, H0 + 74 + i * 40, 0.7 - i * 0.12, sky.night)
      ctx.fillStyle = `rgba(255,214,130,${0.6 + 0.3 * Math.sin(t * 5 + i)})`
      ctx.beginPath()
      ctx.arc(bx, H0 + 40 + i * 40, 5, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,214,130,0.22)'
      ctx.fillRect(bx - 3, H0 + 80 + i * 40, 6, 30)
    }
    // atlayan balık
    const jt = (t * 0.33) % 1
    if (jt < 0.2) {
      const u = jt / 0.2
      ctx.save()
      ctx.translate(560 - u * 120, H0 + 140 - Math.sin(u * Math.PI) * 90)
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

    // iskele
    const deckTop = CH * 0.63
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
    // korkuluk ve martı
    ctx.fillStyle = '#5a3f2a'
    ctx.fillRect(0, deckTop - 6, CW, 12)
    for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 140, deckTop - 70, 12, 70)
    ctx.fillRect(0, deckTop - 64, CW, 8)
    this.gullOnPost(ctx, 600, deckTop - 70, t)
    // şamandıra
    ctx.fillStyle = '#ee6a2c'
    ctx.beginPath()
    ctx.arc(436, deckTop - 36, 17, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillRect(420, deckTop - 41, 32, 8)

    // salaş kulübe (solda)
    this.shackBuilding(ctx, t, sky.night)

    // ışık zincirleri
    for (let s = 0; s < 2; s++) {
      const y0 = 250 + s * 70
      const x0 = 250
      const bulbs = 8
      for (let i = 0; i <= bulbs; i++) {
        const u = i / bulbs
        const x = lerp(x0, CW + 20, u)
        const y = y0 + Math.sin(u * Math.PI) * 52 - u * 30
        if (i > 0) {
          const pu = (i - 1) / bulbs
          ctx.strokeStyle = 'rgba(30,20,20,0.7)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(lerp(x0, CW + 20, pu), y0 + Math.sin(pu * Math.PI) * 52 - pu * 30)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        const fl = 0.75 + 0.25 * Math.sin(t * 3 + i * 1.7 + s)
        const gl = ctx.createRadialGradient(x, y + 8, 1, x, y + 8, 34)
        gl.addColorStop(0, `rgba(255,214,130,${0.6 * fl * (0.4 + sky.night * 0.6)})`)
        gl.addColorStop(1, 'rgba(255,214,130,0)')
        ctx.fillStyle = gl
        ctx.fillRect(x - 36, y - 28, 72, 72)
        ctx.fillStyle = `rgba(255,232,160,${0.55 + 0.45 * fl})`
        ctx.beginPath()
        ctx.arc(x, y + 8, 6, 0, TAU)
        ctx.fill()
      }
    }

    // masa
    const tableTop = 1034
    ctx.fillStyle = '#e9e1cf'
    ctx.beginPath()
    ctx.moveTo(40, tableTop + 30)
    ctx.lineTo(100, tableTop)
    ctx.lineTo(580, tableTop)
    ctx.lineTo(640, tableTop + 30)
    ctx.closePath()
    ctx.fill()

    // kedi (sağ kenar)
    this.cat(ctx, 664, 1196, t, d)

    // kahkaha ve yeme zamanlaması
    const bite = (off: number, from: number, to: number) => this.eatCycle(d, off, from, to)
    const eatA = bite(0, 1.3, 5.6)
    const eatS = bite(0.9, 1.6, 5.4)
    const laughA = smooth((d - 6.0) / 0.7) * smooth((14.2 - d) / 1.2)
    const laughS = smooth((d - 7.1) / 0.7) * smooth((14.2 - d) / 1.2)
    const cheers = pulse(d, 14.6, 17.0, 0.5)
    const clink = d > 15.5 && d < 15.95
    const mouthA = { x: 238, y: 900 }
    const mouthS = { x: 458, y: 904 }
    const restA = { x: 292, y: 1000 }
    const restS = { x: 402, y: 1000 }
    const glassPos = { x: 350, y: 886 }
    const wrapA = {
      x: lerp(lerp(lerp(restA.x, 220, 0.4), mouthA.x + 14, eatA.reach), glassPos.x - 12, cheers),
      y: lerp(lerp(lerp(restA.y, 1030, 0.4), mouthA.y + 26, eatA.reach), glassPos.y, cheers),
    }
    const wrapS = {
      x: lerp(lerp(lerp(restS.x, 480, 0.4), mouthS.x - 14, eatS.reach), glassPos.x + 12, cheers),
      y: lerp(lerp(lerp(restS.y, 1030, 0.4), mouthS.y + 26, eatS.reach), glassPos.y, cheers),
    }
    drawPerson(ctx, {
      who: 'adem', x: 232, y: 1094, s: 1.22, pose: 'dine', t, look: 0.45 + cheers * 0.2, tilt: 0.03 - laughA * 0.22 * (0.5 + 0.5 * Math.sin(t * 3.4)),
      nod: eatA.chew * 2, mouth: Math.max(eatA.mouth * (1 - laughA), laughA * 1.3, cheers * 0.5), joy: Math.max(laughA, cheers * 0.5), inner: 1,
      handA: wrapA, handB: { x: 180, y: 1020 }, bounce: Math.sin(t * 17) * 4 * laughA, hx: -laughA * 4,
    })
    drawPerson(ctx, {
      who: 'sena', x: 452, y: 1094, s: 1.2, pose: 'dine', t, look: -0.45 - cheers * 0.2, tilt: -0.03 + laughS * 0.22 * (0.5 + 0.5 * Math.sin(t * 3.1 + 1)),
      nod: eatS.chew * 2, mouth: Math.max(eatS.mouth * (1 - laughS), laughS * 1.3, cheers * 0.5), joy: Math.max(laughS, cheers * 0.5), inner: -1,
      handA: wrapS, handB: { x: 520, y: 1020 }, bounce: Math.sin(t * 17 + 1.3) * 4 * laughS, hx: laughS * 4,
    })
    // Sena'nın burnundaki sos
    const sauce = smooth((d - 5.2) / 0.3) * smooth((13.4 - d) / 0.4)
    if (sauce > 0) {
      ctx.fillStyle = `rgba(214,60,50,${sauce})`
      ctx.beginPath()
      ctx.ellipse(452 + laughS * 4 + Math.sin(t * 17 + 1.3) * 0.5, 888 + Math.sin(t * 17 + 1.3) * 4 * laughS, 8, 6, 0, 0, TAU)
      ctx.fill()
    }

    // masa örtüsü (naylon, mavi kareli: salaş)
    const clothTop = 1062
    ctx.fillStyle = '#eaf0f6'
    ctx.fillRect(40, clothTop, 600, CH - clothTop)
    ctx.save()
    ctx.beginPath()
    ctx.rect(40, clothTop, 600, CH - clothTop)
    ctx.clip()
    ctx.fillStyle = '#4d86c4'
    const sq = 46
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 14; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(40 + c * sq, clothTop + r * sq, sq, sq)
      }
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(40, clothTop, 600, 8)

    // masa üstü: ayran, limon, patates
    this.ayran(ctx, 150, 1066)
    this.ayran(ctx, 556, 1066)
    this.fries(ctx, 350, 1080)
    ctx.fillStyle = '#ffe36a'
    ctx.beginPath()
    ctx.ellipse(250, 1074, 20, 10, 0, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(466, 1074, 20, 10, 0, 0, TAU)
    ctx.fill()

    // dürümler
    const eaten = (e: { progress: number }, extra = 0) => clamp01(e.progress + extra)
    if (cheers < 0.05) {
      this.wrap(ctx, wrapA.x, wrapA.y, mouthA, eaten(eatA), 0)
      this.wrap(ctx, wrapS.x, wrapS.y, mouthS, eaten(eatS), 1)
    } else {
      this.glass(ctx, wrapA.x, wrapA.y, cheers)
      this.glass(ctx, wrapS.x, wrapS.y, cheers)
    }
    if (clink) {
      const u = (d - 15.5) / 0.45
      ctx.strokeStyle = `rgba(255,240,180,${1 - u})`
      ctx.lineWidth = 3
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU
        ctx.beginPath()
        ctx.moveTo(350 + Math.cos(a) * (14 + u * 6), 860 + Math.sin(a) * (14 + u * 6))
        ctx.lineTo(350 + Math.cos(a) * (26 + u * 30), 860 + Math.sin(a) * (26 + u * 30))
        ctx.stroke()
      }
    }
    ctx.restore()

    // konuşma balonları ve kahkaha yazıları
    this.bubble(ctx, 'Burnunda sos var!', d > 5 ? t : 0, 26.6 + 5.4, 26.6 + 7.6, 250, 745, 238, 800)
    for (const [i, [x, y, text]] of ([[160, 735, 'HA HA!'], [560, 735, 'HAHAHA'], [200, 660, 'HA HA HA!'], [530, 660, 'HIH HIH!']] as [number, number, string][]).entries()) {
      const a = 26.6 + 6.6 + i * 1.1
      this.bubble(ctx, text, t, a, a + 1.5, x, y, x < 360 ? 238 : 458, 860, i % 2 ? '#fff0b8' : '#ffffff', 36)
    }
    this.bubble(ctx, 'Şerefe!', t, 26.6 + 14.6, 26.6 + 16.8, 360, 780, 350, 850, '#ffe3ef', 36)
    this.hearts(ctx, t, 360, 820, 26.6 + 15.8, 44, 0.6)
    this.caption(ctx, 'Akşam da salaş balıkçıda balık dürüm...', t, 27.4, 34, 100)
    ctx.fillStyle = `rgba(20,10,40,${0.16 * (1 - sky.night)})`
    ctx.fillRect(0, 0, CW, CH)
  }

  private eatCycle(d: number, offset: number, from: number, to: number) {
    const per = 2.4
    const k = ((d + offset) % per) / per
    const active = d > from && d < to ? 1 : 0
    const reach = active * smooth(Math.sin(k * TAU - Math.PI / 2) * 0.5 + 0.5)
    const chew = active && k > 0.55 && k < 0.95 ? Math.sin(d * 22) * 0.5 + 0.5 : 0
    const progress = clamp01((d - from) / (to - from)) * 0.55
    return { reach, mouth: (reach > 0.8 ? 0.7 : 0) + chew * 0.35, chew, progress }
  }

  private shackBuilding(ctx: CanvasRenderingContext2D, t: number, night: number) {
    // tahta duvar
    ctx.fillStyle = '#6b4a31'
    ctx.fillRect(0, 340, 250, 470)
    ctx.strokeStyle = 'rgba(20,10,5,0.45)'
    ctx.lineWidth = 3
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.moveTo(i * 42, 340)
      ctx.lineTo(i * 42, 810)
      ctx.stroke()
    }
    // tezgâh penceresi (içerisi sıcak ışık)
    ctx.fillStyle = '#2b1a12'
    ctx.fillRect(24, 520, 190, 150)
    const wl = ctx.createRadialGradient(120, 600, 6, 120, 600, 130)
    wl.addColorStop(0, `rgba(255,190,100,${0.75 + 0.15 * Math.sin(t * 7)})`)
    wl.addColorStop(1, 'rgba(255,150,70,0.1)')
    ctx.fillStyle = wl
    ctx.fillRect(24, 520, 190, 150)
    // ızgara ve balıklar
    ctx.fillStyle = '#3a2a22'
    ctx.fillRect(40, 630, 160, 14)
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#c9d3dc'
      ctx.beginPath()
      ctx.ellipse(70 + i * 50, 622, 20, 7, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(88 + i * 50, 622)
      ctx.lineTo(102 + i * 50, 614)
      ctx.lineTo(102 + i * 50, 630)
      ctx.fill()
    }
    for (let i = 0; i < 5; i++) {
      const fl = Math.sin(t * 9 + i * 1.9)
      ctx.fillStyle = `rgba(255,${130 + fl * 40},40,0.85)`
      ctx.beginPath()
      ctx.moveTo(52 + i * 32, 660)
      ctx.quadraticCurveTo(58 + i * 32 + fl * 4, 640 - fl * 6, 66 + i * 32, 660)
      ctx.fill()
    }
    // duman
    for (let i = 0; i < 6; i++) {
      const u = ((t * 0.35 + i / 6) % 1)
      ctx.fillStyle = `rgba(210,200,210,${0.28 * (1 - u)})`
      ctx.beginPath()
      ctx.arc(110 + Math.sin(u * 5 + i) * 30, 500 - u * 160, 14 + u * 26, 0, TAU)
      ctx.fill()
    }
    // tezgâh üst tahtası
    ctx.fillStyle = '#8a5a35'
    ctx.fillRect(10, 668, 220, 16)
    // ağ ve şamandıralar
    ctx.strokeStyle = 'rgba(230,220,190,0.55)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 9; i++) {
      ctx.beginPath()
      ctx.moveTo(132 + i * 13, 372)
      ctx.lineTo(120 + i * 13, 500)
      ctx.stroke()
    }
    for (let j = 0; j < 8; j++) {
      ctx.beginPath()
      ctx.moveTo(120, 372 + j * 17)
      ctx.lineTo(250, 372 + j * 17 + 4)
      ctx.stroke()
    }
    ctx.fillStyle = '#ee6a2c'
    for (const [x, y] of [[140, 392], [200, 448], [160, 490]]) {
      ctx.beginPath()
      ctx.arc(x, y, 9, 0, TAU)
      ctx.fill()
    }
    // kasalar
    ctx.fillStyle = '#9a6a42'
    ctx.fillRect(10, 740, 120, 70)
    ctx.fillRect(140, 770, 90, 40)
    ctx.strokeStyle = 'rgba(30,15,5,0.6)'
    ctx.lineWidth = 3
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(10, 756 + i * 18)
      ctx.lineTo(130, 756 + i * 18)
      ctx.stroke()
    }
    // oluklu saç çatı
    ctx.fillStyle = '#8a9096'
    ctx.beginPath()
    ctx.moveTo(-20, 290)
    ctx.lineTo(330, 268)
    ctx.lineTo(330, 336)
    ctx.lineTo(-20, 356)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(40,45,55,0.5)'
    ctx.lineWidth = 3
    for (let i = 0; i < 17; i++) {
      ctx.beginPath()
      ctx.moveTo(-10 + i * 21, 292 - i * 1.2)
      ctx.lineTo(-10 + i * 21, 352 - i * 1.2)
      ctx.stroke()
    }
    ctx.fillStyle = '#6a6f75'
    ctx.fillRect(-20, 350, 350, 8)
    // tabela
    ctx.save()
    ctx.translate(150, 436)
    ctx.rotate(-0.03 + Math.sin(t * 1.4) * 0.012)
    ctx.fillStyle = '#2a5d8f'
    ctx.fillRect(-124, -34, 248, 68)
    ctx.strokeStyle = '#fbe7b0'
    ctx.lineWidth = 3
    ctx.strokeRect(-117, -27, 234, 54)
    ctx.fillStyle = '#fff2c4'
    ctx.font = `800 31px ${FONT_SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('BALIK DÜRÜM', 0, 3)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(255,230,150,${0.55 + 0.45 * Math.sin(t * 4 + i)})`
      ctx.beginPath()
      ctx.arc(-110 + i * 44, -42, 5, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
    void night
  }

  private gullOnPost(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    ctx.save()
    ctx.translate(x, y)
    const bob = Math.sin(t * 2.2) * 1.2
    ctx.fillStyle = '#e9e9ee'
    ctx.beginPath()
    ctx.ellipse(0, -18 + bob, 22, 16, 0, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-14, -34 + bob, 10, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#f4b73c'
    ctx.beginPath()
    ctx.moveTo(-23, -34 + bob)
    ctx.lineTo(-36, -30 + bob)
    ctx.lineTo(-23, -29 + bob)
    ctx.fill()
    ctx.fillStyle = '#222'
    ctx.beginPath()
    ctx.arc(-17, -36 + bob, 1.8, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#9a9ba6'
    ctx.beginPath()
    ctx.ellipse(8, -20 + bob, 16, 8, 0.2, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  private cat(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, d: number) {
    ctx.save()
    ctx.translate(x, y)
    const tail = Math.sin(t * 2.6) * 0.5
    ctx.strokeStyle = '#8f8a86'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(26, 6)
    ctx.quadraticCurveTo(70, 10 + tail * 30, 66, -34 + tail * 24)
    ctx.stroke()
    ctx.fillStyle = '#9a9591'
    ctx.beginPath()
    ctx.ellipse(0, -2, 40, 52, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#6f6a67'
    ctx.lineWidth = 4
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-26, -28 + i * 18)
      ctx.lineTo(-8, -22 + i * 18)
      ctx.stroke()
    }
    // kafa: yemek yiyenlere bakar
    const look = Math.sin(d * 0.7) * 0.4
    ctx.fillStyle = '#9a9591'
    ctx.beginPath()
    ctx.arc(-6, -62, 28, 0, TAU)
    ctx.fill()
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(-6 + sd * 12, -80)
      ctx.lineTo(-6 + sd * 26, -104)
      ctx.lineTo(-6 + sd * 28, -76)
      ctx.fill()
    }
    ctx.fillStyle = '#fff'
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(-6 + sd * 10, -64, 6, 7, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#2a2a2a'
      ctx.beginPath()
      ctx.ellipse(-6 + sd * 10 - 2 + look * 3, -64, 2.6, 5, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#fff'
    }
    ctx.fillStyle = '#e88a8a'
    ctx.beginPath()
    ctx.arc(-6, -54, 3, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  private ayran(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#f7f4ec'
    ctx.beginPath()
    ctx.moveTo(x - 20, y - 56)
    ctx.lineTo(x + 20, y - 56)
    ctx.lineTo(x + 15, y)
    ctx.lineTo(x - 15, y)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(x, y - 56, 20, 6, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#d33a3a'
    ctx.fillRect(x - 18, y - 36, 36, 8)
  }

  private fries(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#d94c3d'
    ctx.beginPath()
    ctx.moveTo(x - 30, y - 20)
    ctx.lineTo(x + 30, y - 20)
    ctx.lineTo(x + 24, y + 10)
    ctx.lineTo(x - 24, y + 10)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#f6c24a'
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(x + i * 8, y - 18)
      ctx.lineTo(x + i * 8 + (i % 2 ? 4 : -4), y - 44 - (i % 3) * 5)
      ctx.stroke()
    }
  }

  /** Kâğıda sarılı balık dürüm; ağız tarafına doğru yönelir, yendikçe küçülür. */
  private wrap(ctx: CanvasRenderingContext2D, x: number, y: number, mouth: { x: number; y: number }, eaten: number, who: 0 | 1) {
    const ang = Math.atan2(mouth.y - y, mouth.x - x)
    const len = 112 * (1 - eaten * 0.7)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    const w = 40
    // sarmal (lavaş)
    ctx.fillStyle = '#f0d49b'
    ctx.beginPath()
    ctx.roundRect?.(-12, -w / 2, len, w, 18)
    if (!ctx.roundRect) ctx.rect(-12, -w / 2, len, w)
    ctx.fill()
    ctx.strokeStyle = 'rgba(150,100,40,0.5)'
    ctx.lineWidth = 3
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(len * 0.35 + i * 14, -w / 2 + 4)
      ctx.lineTo(len * 0.35 + i * 14 + 6, w / 2 - 4)
      ctx.stroke()
    }
    // kâğıt (elde tutulan taraf)
    ctx.fillStyle = who ? '#fff7e0' : '#f5f0e6'
    ctx.beginPath()
    ctx.moveTo(-12, -w / 2 - 2)
    ctx.lineTo(len * 0.42, -w / 2 - 2)
    ctx.lineTo(len * 0.42, w / 2 + 2)
    ctx.lineTo(-12, w / 2 + 2)
    ctx.fill()
    ctx.fillStyle = '#d94c3d'
    ctx.fillRect(len * 0.3, -w / 2 - 2, 7, w + 4)
    // açık uç: marul, domates, balık
    const ex = len - 12
    ctx.fillStyle = '#7ac56a'
    ctx.beginPath()
    ctx.ellipse(ex, -6, 12, 12, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#e5503a'
    ctx.beginPath()
    ctx.arc(ex + 4, 8, 8, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#f4c7a0'
    ctx.beginPath()
    ctx.ellipse(ex + 2, 0, 9, 6, 0.3, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  private glass(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(x, y - 6)
    ctx.fillStyle = '#f7f4ec'
    ctx.beginPath()
    ctx.moveTo(-18, -34)
    ctx.lineTo(18, -34)
    ctx.lineTo(13, 24)
    ctx.lineTo(-13, 24)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(0, -34, 18, 6, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#d33a3a'
    ctx.fillRect(-16, -14, 32, 9)
    ctx.restore()
  }

  // ---------- kapanış ----------
  private endCard(ctx: CanvasRenderingContext2D, t: number) {
    const u = t - 43.2
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
    heartAt(ctx, this.heartPath, CW / 2, 470, 300 * beat, '#ff7fa5', 0.9)
    ctx.fillStyle = '#fff'
    ctx.font = `300 120px ${FONT_SERIF}`
    ctx.fillText(this.days.toLocaleString('tr-TR'), CW / 2, 450)
    ctx.font = `italic 400 40px ${FONT_SERIF}`
    ctx.fillText('gün', CW / 2, 548)
    ctx.globalAlpha = a * smooth((u - 0.7) / 0.8)
    ctx.fillStyle = '#ffe3ea'
    ctx.font = `500 64px ${FONT_SERIF}`
    ctx.fillText(`${this.input.b} & ${this.input.a}`, CW / 2, 820)
    ctx.font = `italic 400 44px ${FONT_SERIF}`
    ctx.fillText('Daha çok anımız olacak.', CW / 2, 910)
    ctx.globalAlpha = 1
    this.hearts(ctx, t, 360, 760, 43.4, 47, 0.45)
  }
}
