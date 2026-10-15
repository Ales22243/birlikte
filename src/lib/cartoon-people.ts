// Çizgi film karakterleri: Adem ve Sena. Tamamen vektör çizim; her kare zamandan hesaplanır.
const TAU = Math.PI * 2

export type Who = 'adem' | 'sena'
export type Pose = 'sit' | 'walk' | 'dine'

export interface PState {
  who: Who
  /** Yerdeki (oturanlarda oturma) nokta, tuval koordinatı */
  x: number
  y: number
  s: number
  pose: Pose
  /** Küresel zaman (göz kırpma, saç sallanması) */
  t: number
  /** Yürüme evresi */
  ph?: number
  /** Bakış yönü -1..1 */
  look: number
  /** Baş eğimi (radyan) */
  tilt: number
  /** Ağız açıklığı 0..1 */
  mouth: number
  /** Oturanlarda ele tutuşulan taraf: Adem için +1 (sağa), Sena için -1 */
  inner?: 1 | -1
  /** Tuval koordinatında hedef eller */
  handA?: { x: number; y: number }
  handB?: { x: number; y: number }
  /** Baş öne eğimi (yemekte kafa hafif yukarı/aşağı) */
  nod?: number
  /** Kalın gülümseme (gözler kapanır) */
  squint?: number
  /** Başın yatay kayması (yerel birim) */
  hx?: number
}

const SKIN = { adem: '#efc29a', sena: '#f6d5b8' }
const HAIR_A = '#3a2b22'
const BEARD = '#4a3427'
const HAIR_S = '#c98a55'
const HAIR_S_LIGHT = '#e9bd82'
const SHIRT_A = '#f08a24'
const DRESS_S = '#b4c99b'
const TROUSER = '#c9b79a'

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU)
}

/** İki parçalı kol/bacak: omuz-kalçadan hedefe, dirsek/diz bükülmesiyle. */
function limb(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  l1: number,
  l2: number,
  bend: 1 | -1,
  w1: number,
  c1: string,
  w2: number,
  c2: string,
): { x: number; y: number } {
  let dx = tx - sx
  let dy = ty - sy
  let d = Math.hypot(dx, dy)
  const max = l1 + l2 - 0.5
  if (d > max) {
    dx *= max / d
    dy *= max / d
    d = max
  }
  if (d < 6) {
    d = 6
    dx = 0
    dy = 6
  }
  const base = Math.atan2(dy, dx)
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)))
  const ang = base + bend * a
  const ex = sx + Math.cos(ang) * l1
  const ey = sy + Math.sin(ang) * l1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = c1
  ctx.lineWidth = w1
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.strokeStyle = c2
  ctx.lineWidth = w2
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(sx + dx, sy + dy)
  ctx.stroke()
  return { x: sx + dx, y: sy + dy }
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, look: number, blink: number, lash: boolean) {
  const rx = R * 0.17
  const ry = R * 0.2 * (1 - blink * 0.94)
  if (blink > 0.85) {
    ctx.strokeStyle = '#2a1a14'
    ctx.lineWidth = R * 0.05
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x, y - R * 0.02, rx, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
    return
  }
  ctx.fillStyle = '#fff'
  ellipse(ctx, x, y, rx, ry)
  ctx.fill()
  ctx.save()
  ellipse(ctx, x, y, rx, ry)
  ctx.clip()
  ctx.fillStyle = '#6a4326'
  ctx.beginPath()
  ctx.arc(x + look * R * 0.07, y + R * 0.01, R * 0.125, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#1c110b'
  ctx.beginPath()
  ctx.arc(x + look * R * 0.075, y + R * 0.01, R * 0.065, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x + look * R * 0.07 - R * 0.035, y - R * 0.045, R * 0.032, 0, TAU)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = lash ? '#2a1a14' : '#3a2a20'
  ctx.lineWidth = R * (lash ? 0.055 : 0.04)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.ellipse(x, y, rx * 1.04, ry * 1.04, 0, Math.PI * 1.02, Math.PI * 1.98)
  ctx.stroke()
  if (lash) {
    ctx.beginPath()
    ctx.moveTo(x + rx, y - ry * 0.7)
    ctx.lineTo(x + rx * 1.35, y - ry * 1.05)
    ctx.stroke()
  }
}

function brow(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, color: string, thick: number, raise: number) {
  ctx.strokeStyle = color
  ctx.lineWidth = R * thick
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - R * 0.2, y + R * 0.02 - raise)
  ctx.quadraticCurveTo(x, y - R * 0.07 - raise, x + R * 0.2, y + R * 0.03 - raise)
  ctx.stroke()
}

function mouthShape(ctx: CanvasRenderingContext2D, R: number, my: number, w: number, open: number, lip: string) {
  if (open < 0.12) {
    ctx.strokeStyle = lip
    ctx.lineWidth = R * 0.06
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-w, my - R * 0.02)
    ctx.quadraticCurveTo(0, my + R * 0.16, w, my - R * 0.02)
    ctx.stroke()
    return
  }
  const h = R * (0.1 + 0.26 * open)
  ctx.fillStyle = '#7a2e33'
  ctx.beginPath()
  ctx.moveTo(-w, my - R * 0.02)
  ctx.quadraticCurveTo(0, my + h * 1.9, w, my - R * 0.02)
  ctx.quadraticCurveTo(0, my + R * 0.03, -w, my - R * 0.02)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(-w * 0.82, my - R * 0.012)
  ctx.quadraticCurveTo(0, my + R * 0.05, w * 0.82, my - R * 0.012)
  ctx.quadraticCurveTo(0, my + R * 0.1 + h * 0.15, -w * 0.82, my - R * 0.012)
  ctx.fill()
  ctx.fillStyle = '#d96a6a'
  ellipse(ctx, 0, my + h * 0.95, w * 0.42, h * 0.38)
  ctx.fill()
}

function blinkAmount(t: number, who: Who): number {
  const period = who === 'adem' ? 3.3 : 2.9
  const k = ((t + (who === 'adem' ? 0.7 : 1.9)) % period) / period
  const w = 0.045
  if (k > 1 - w) return Math.sin(((k - (1 - w)) / w) * Math.PI)
  return 0
}

function drawHeadFront(ctx: CanvasRenderingContext2D, who: Who, R: number, p: PState) {
  const skin = SKIN[who]
  const blink = Math.max(blinkAmount(p.t, who), p.squint ?? 0)
  const look = p.look
  // kulaklar
  ctx.fillStyle = skin
  ellipse(ctx, -R * 0.97, R * 0.08, R * 0.12, R * 0.2)
  ctx.fill()
  ellipse(ctx, R * 0.97, R * 0.08, R * 0.12, R * 0.2)
  ctx.fill()
  // yüz
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.moveTo(-R * 0.95, -R * 0.1)
  ctx.bezierCurveTo(-R * 0.95, -R * 1.1, R * 0.95, -R * 1.1, R * 0.95, -R * 0.1)
  ctx.bezierCurveTo(R * 0.98, R * 0.7, R * 0.55, R * 1.08, 0, R * 1.1)
  ctx.bezierCurveTo(-R * 0.55, R * 1.08, -R * 0.98, R * 0.7, -R * 0.95, -R * 0.1)
  ctx.fill()

  if (who === 'adem') {
    // Sakal
    ctx.fillStyle = BEARD
    ctx.beginPath()
    ctx.moveTo(-R * 0.96, -R * 0.02)
    ctx.bezierCurveTo(-R * 1.02, R * 0.85, -R * 0.55, R * 1.2, 0, R * 1.24)
    ctx.bezierCurveTo(R * 0.55, R * 1.2, R * 1.02, R * 0.85, R * 0.96, -R * 0.02)
    ctx.bezierCurveTo(R * 0.78, R * 0.34, R * 0.5, R * 0.4, R * 0.26, R * 0.36)
    ctx.bezierCurveTo(R * 0.1, R * 0.33, -R * 0.1, R * 0.33, -R * 0.26, R * 0.36)
    ctx.bezierCurveTo(-R * 0.5, R * 0.4, -R * 0.78, R * 0.34, -R * 0.96, -R * 0.02)
    ctx.fill()
    // bıyık
    ctx.beginPath()
    ctx.moveTo(-R * 0.3, R * 0.4)
    ctx.quadraticCurveTo(0, R * 0.3, R * 0.3, R * 0.4)
    ctx.quadraticCurveTo(0, R * 0.46, -R * 0.3, R * 0.4)
    ctx.fill()
    // saç: geriye çekilmiş saç çizgisi
    ctx.fillStyle = HAIR_A
    ctx.beginPath()
    ctx.moveTo(-R * 1.0, R * 0.0)
    ctx.bezierCurveTo(-R * 1.12, -R * 1.0, -R * 0.5, -R * 1.34, 0, -R * 1.3)
    ctx.bezierCurveTo(R * 0.5, -R * 1.34, R * 1.12, -R * 1.0, R * 1.0, R * 0.0)
    ctx.bezierCurveTo(R * 0.96, -R * 0.2, R * 0.82, -R * 0.4, R * 0.68, -R * 0.52)
    ctx.bezierCurveTo(R * 0.4, -R * 0.74, -R * 0.4, -R * 0.74, -R * 0.68, -R * 0.52)
    ctx.bezierCurveTo(-R * 0.82, -R * 0.4, -R * 0.96, -R * 0.2, -R * 1.0, R * 0.0)
    ctx.fill()
  } else {
    // Sena: ortadan ayrık, yüzü çerçeveleyen saç
    ctx.fillStyle = HAIR_S
    ctx.beginPath()
    ctx.moveTo(0, -R * 1.22)
    ctx.bezierCurveTo(-R * 1.1, -R * 1.15, -R * 1.22, -R * 0.1, -R * 1.08, R * 0.5)
    ctx.bezierCurveTo(-R * 0.98, R * 0.1, -R * 0.84, -R * 0.4, -R * 0.52, -R * 0.62)
    ctx.bezierCurveTo(-R * 0.3, -R * 0.8, -R * 0.1, -R * 0.9, 0, -R * 1.0)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, -R * 1.22)
    ctx.bezierCurveTo(R * 1.1, -R * 1.15, R * 1.22, -R * 0.1, R * 1.08, R * 0.5)
    ctx.bezierCurveTo(R * 0.98, R * 0.1, R * 0.84, -R * 0.4, R * 0.52, -R * 0.62)
    ctx.bezierCurveTo(R * 0.3, -R * 0.8, R * 0.1, -R * 0.9, 0, -R * 1.0)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = HAIR_S_LIGHT
    ctx.lineWidth = R * 0.05
    ctx.lineCap = 'round'
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(sd * R * 0.12, -R * 1.12)
      ctx.bezierCurveTo(sd * R * 0.7, -R * 1.0, sd * R * 0.95, -R * 0.4, sd * R * 0.98, R * 0.2)
      ctx.stroke()
    }
  }

  // yanaklar
  const blush = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.22)
  blush.addColorStop(0, 'rgba(255,120,120,0.35)')
  blush.addColorStop(1, 'rgba(255,120,120,0)')
  for (const sd of [-1, 1]) {
    ctx.save()
    ctx.translate(sd * R * 0.56, R * 0.42)
    ctx.fillStyle = blush
    ctx.fillRect(-R * 0.3, -R * 0.3, R * 0.6, R * 0.6)
    ctx.restore()
  }
  // gözler ve kaşlar
  const ey = -R * 0.08
  eye(ctx, -R * 0.38, ey, R, look, blink, who === 'sena')
  eye(ctx, R * 0.38, ey, R, look, blink, who === 'sena')
  const raise = (p.squint ?? 0) * R * 0.04
  if (who === 'adem') {
    brow(ctx, -R * 0.38, -R * 0.38, R, '#2f221b', 0.09, raise)
    brow(ctx, R * 0.38, -R * 0.38, R, '#2f221b', 0.09, raise)
  } else {
    brow(ctx, -R * 0.38, -R * 0.4, R, '#9a6540', 0.06, raise)
    brow(ctx, R * 0.38, -R * 0.4, R, '#9a6540', 0.06, raise)
  }
  // burun
  ctx.strokeStyle = who === 'adem' ? '#c98f69' : '#e0a883'
  ctx.lineWidth = R * 0.045
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(look * R * 0.05, R * 0.04)
  ctx.quadraticCurveTo(look * R * 0.05 + R * 0.09, R * 0.3, look * R * 0.05 - R * 0.02, R * 0.32)
  ctx.stroke()
  // ağız
  if (who === 'adem') mouthShape(ctx, R, R * 0.6, R * 0.26, p.mouth, '#e8a79a')
  else mouthShape(ctx, R, R * 0.58, R * 0.24, p.mouth, '#d2625f')
  if (who === 'sena') {
    ctx.fillStyle = '#e9bf6a'
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(sd * R * 1.0, R * 0.34, R * 0.1, 0, TAU)
      ctx.fill()
    }
  }
}

function drawBackHair(ctx: CanvasRenderingContext2D, R: number, p: PState) {
  // Sena'nın omuza inen uzun saçı (kafanın arkası)
  const sway = Math.sin(p.t * 1.6) * R * 0.05 + (p.pose === 'walk' ? Math.sin((p.ph ?? 0) * 1) * R * 0.1 : 0)
  ctx.fillStyle = HAIR_S
  ctx.beginPath()
  ctx.moveTo(-R * 1.1, -R * 0.2)
  ctx.bezierCurveTo(-R * 1.35, R * 0.8, -R * 1.2 + sway, R * 1.8, -R * 1.18 + sway, R * 2.45)
  ctx.quadraticCurveTo(-R * 0.4 + sway, R * 2.7, 0, R * 2.5)
  ctx.quadraticCurveTo(R * 0.4 + sway, R * 2.7, R * 1.18 + sway, R * 2.45)
  ctx.bezierCurveTo(R * 1.2 + sway, R * 1.8, R * 1.35, R * 0.8, R * 1.1, -R * 0.2)
  ctx.bezierCurveTo(R * 1.1, -R * 1.2, -R * 1.1, -R * 1.2, -R * 1.1, -R * 0.2)
  ctx.fill()
  ctx.strokeStyle = HAIR_S_LIGHT
  ctx.lineWidth = R * 0.07
  ctx.lineCap = 'round'
  for (const sd of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sd * R * 0.9, R * 0.5)
    ctx.bezierCurveTo(sd * R * 1.08, R * 1.2, sd * R * 0.98 + sway, R * 1.8, sd * R * 0.95 + sway, R * 2.3)
    ctx.stroke()
  }
}

function drawTorso(ctx: CanvasRenderingContext2D, who: Who, hx: number, hy: number, lean: number) {
  const adem = who === 'adem'
  const sw = adem ? 132 : 112
  const tw = adem ? 116 : 84
  const th = 120
  const sy = hy - th
  const col = adem ? SHIRT_A : DRESS_S
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.moveTo(hx - tw / 2, hy)
  ctx.lineTo(hx - sw / 2 + lean, sy + 18)
  ctx.quadraticCurveTo(hx - sw / 2 + lean, sy, hx - sw / 2 + 22 + lean, sy)
  ctx.lineTo(hx + sw / 2 - 22 + lean, sy)
  ctx.quadraticCurveTo(hx + sw / 2 + lean, sy, hx + sw / 2 + lean, sy + 18)
  ctx.lineTo(hx + tw / 2, hy)
  ctx.closePath()
  ctx.fill()
  // yaka / dekolte
  ctx.fillStyle = SKIN[who]
  ctx.beginPath()
  if (adem) {
    ctx.moveTo(hx - 22 + lean, sy)
    ctx.lineTo(hx + lean, sy + 34)
    ctx.lineTo(hx + 22 + lean, sy)
  } else {
    ctx.moveTo(hx - 26 + lean, sy)
    ctx.quadraticCurveTo(hx + lean, sy + 40, hx + 26 + lean, sy)
  }
  ctx.fill()
  if (adem) {
    ctx.fillStyle = '#d97312'
    ctx.beginPath()
    ctx.moveTo(hx - 30 + lean, sy - 2)
    ctx.lineTo(hx - 4 + lean, sy + 40)
    ctx.lineTo(hx - 22 + lean, sy + 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(hx + 30 + lean, sy - 2)
    ctx.lineTo(hx + 4 + lean, sy + 40)
    ctx.lineTo(hx + 22 + lean, sy + 2)
    ctx.fill()
    ctx.fillStyle = '#fff2'
    for (const k of [1, 2, 3]) {
      ctx.beginPath()
      ctx.arc(hx + lean * (1 - k * 0.2), sy + 34 + k * 24, 3, 0, TAU)
      ctx.fill()
    }
  } else {
    ctx.strokeStyle = '#e4bd6a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(hx - 18 + lean, sy + 2)
    ctx.quadraticCurveTo(hx + lean, sy + 44, hx + 18 + lean, sy + 2)
    ctx.stroke()
  }
}

/** Karakteri çizer. Yerel başlangıç (0,0): oturanlarda oturma noktası, yürüyenlerde ayak hizası. */
export function drawPerson(ctx: CanvasRenderingContext2D, p: PState) {
  const adem = p.who === 'adem'
  const R = adem ? 60 : 55
  const sleeve = adem ? SHIRT_A : DRESS_S
  const skin = SKIN[p.who]
  const toLocal = (g: { x: number; y: number }) => ({ x: (g.x - p.x) / p.s, y: (g.y - p.y) / p.s })

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(p.s, p.s)

  // gölge
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ellipse(ctx, 0, p.pose === 'walk' ? 4 : 6, 96, 12)
  ctx.fill()

  const breathe = 1 + Math.sin(p.t * 2.2 + (adem ? 0 : 1)) * 0.012

  if (p.pose === 'walk') {
    const ph = p.ph ?? 0
    const bob = -Math.abs(Math.sin(ph)) * 7
    const hipY = -128 + bob
    const lean = 6
    // arka bacak, sonra gövde, ön bacak
    const stride = 46
    const lift = 24
    const footA = { x: Math.sin(ph) * stride, y: -Math.max(0, Math.cos(ph)) * lift }
    const footB = { x: Math.sin(ph + Math.PI) * stride, y: -Math.max(0, Math.cos(ph + Math.PI)) * lift }
    const far = Math.cos(ph) > 0 ? footB : footA
    const near = far === footA ? footB : footA
    const legColor = adem ? TROUSER : skin
    limb(ctx, -6, hipY, far.x, far.y - 8, 66, 66, -1, 28, adem ? '#b8a688' : skin, 24, adem ? '#b8a688' : skin)
    ctx.fillStyle = adem ? '#6b4a33' : '#f1e6d6'
    ellipse(ctx, far.x + 8, far.y - 2, 20, 9)
    ctx.fill()
    // uzak kol (arkada kalan)
    const shoulderY = hipY - 118
    const sx = lean
    const swing = Math.sin(ph + Math.PI) * 30
    const handFar = p.handA ? toLocal(p.handA) : { x: sx + swing, y: shoulderY + 100 }
    limb(ctx, sx - 4, shoulderY + 6, handFar.x, handFar.y, 52, 52, 1, adem ? 24 : 22, sleeve, adem ? 17 : 16, skin)
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.arc(handFar.x, handFar.y, 11, 0, TAU)
    ctx.fill()
    if (p.who === 'sena') {
      ctx.save()
      ctx.translate(lean + 4 + (p.hx ?? 0), shoulderY - R * 0.95 + bob * 0.4)
      ctx.rotate(p.tilt)
      drawBackHair(ctx, R, p)
      ctx.restore()
    }
    // etek / pantolon üstü
    if (adem) {
      ctx.fillStyle = TROUSER
      ctx.beginPath()
      ctx.moveTo(-54, hipY - 12)
      ctx.lineTo(54, hipY - 12)
      ctx.lineTo(48, hipY + 36)
      ctx.lineTo(-48, hipY + 36)
      ctx.fill()
    } else {
      ctx.fillStyle = DRESS_S
      ctx.beginPath()
      ctx.moveTo(-42, hipY - 10)
      ctx.lineTo(42, hipY - 10)
      ctx.quadraticCurveTo(76 + Math.sin(ph) * 8, hipY + 36, 66, hipY + 74)
      ctx.lineTo(-66, hipY + 74)
      ctx.quadraticCurveTo(-76 - Math.sin(ph) * 8, hipY + 36, -42, hipY - 10)
      ctx.fill()
    }
    limb(ctx, 6, hipY, near.x, near.y - 8, 66, 66, -1, 28, adem ? TROUSER : skin, 24, adem ? TROUSER : skin)
    void legColor
    ctx.fillStyle = adem ? '#7c573a' : '#f4ead9'
    ellipse(ctx, near.x + 8, near.y - 2, 21, 10)
    ctx.fill()
    ctx.save()
    ctx.scale(1, breathe)
    drawTorso(ctx, p.who, 0, hipY + 4, lean)
    ctx.restore()
    // ön kol
    const swingN = Math.sin(ph) * 30
    const handNear = p.handB ? toLocal(p.handB) : { x: sx + swingN, y: shoulderY + 100 }
    limb(ctx, sx - 4, shoulderY + 6, handNear.x, handNear.y, 52, 52, 1, adem ? 26 : 22, sleeve, adem ? 18 : 16, skin)
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.arc(handNear.x, handNear.y, adem ? 12 : 11, 0, TAU)
    ctx.fill()
    // baş
    ctx.save()
    ctx.translate(lean + 4 + (p.hx ?? 0), shoulderY - R * 0.95 + bob * 0.4)
    ctx.rotate(p.tilt)
    ctx.fillStyle = skin
    ctx.fillRect(-14, R * 0.7, 28, 40)
    drawHeadFront(ctx, p.who, R, p)
    ctx.restore()
  } else {
    // oturan (kumsal) ya da yemek masası
    const hipY = -20
    const shoulderY = hipY - 118
    const sit = p.pose === 'sit'
    const inner = p.inner ?? 1
    if (!sit) {
      /* masa arkasında: alt gövde masayla örtülür */
    }
    if (p.who === 'sena') {
      ctx.save()
      ctx.translate(p.hx ?? 0, shoulderY - R * 0.95 + (p.nod ?? 0))
      ctx.rotate(p.tilt)
      drawBackHair(ctx, R, p)
      ctx.restore()
    }
    if (sit) {
      // bağdaş kurmuş bacaklar
      ctx.lineCap = 'round'
      ctx.strokeStyle = adem ? TROUSER : DRESS_S
      ctx.lineWidth = 34
      ctx.beginPath()
      ctx.moveTo(-70, hipY + 24)
      ctx.quadraticCurveTo(-8, hipY + 52, 56, hipY + 28)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(70, hipY + 24)
      ctx.quadraticCurveTo(8, hipY + 52, -56, hipY + 28)
      ctx.stroke()
      if (!adem) {
        ctx.fillStyle = DRESS_S
        ellipse(ctx, 0, hipY + 10, 92, 30)
        ctx.fill()
      }
      ctx.fillStyle = skin
      ellipse(ctx, -58, hipY + 34, 17, 11)
      ctx.fill()
      ellipse(ctx, 58, hipY + 34, 17, 11)
      ctx.fill()
    }
    ctx.save()
    ctx.translate(0, hipY)
    ctx.scale(1, breathe)
    ctx.translate(0, -hipY)
    drawTorso(ctx, p.who, 0, hipY + 6, 0)
    ctx.restore()
    // kollar
    const sxL = -(adem ? 62 : 52)
    const sxR = adem ? 62 : 52
    const innerSx = inner === 1 ? sxR : sxL
    const outerSx = inner === 1 ? sxL : sxR
    const upperW = adem ? 26 : 22
    const handIn = p.handA ? toLocal(p.handA) : { x: inner * 52, y: hipY + 8 }
    const handOut = p.handB ? toLocal(p.handB) : { x: -inner * 74, y: hipY + 14 }
    const bend = (inner === 1 ? 1 : -1) as 1 | -1
    const a1 = limb(ctx, innerSx, shoulderY + 10, handIn.x, handIn.y, 56, 54, bend, upperW, sleeve, adem ? 18 : 16, skin)
    const a2 = limb(ctx, outerSx, shoulderY + 10, handOut.x, handOut.y, 56, 54, (-bend) as 1 | -1, upperW, sleeve, adem ? 18 : 16, skin)
    ctx.fillStyle = skin
    for (const h of [a1, a2]) {
      ctx.beginPath()
      ctx.arc(h.x, h.y, adem ? 12 : 11, 0, TAU)
      ctx.fill()
    }
    // baş
    ctx.save()
    ctx.translate(p.hx ?? 0, shoulderY - R * 0.95 + (p.nod ?? 0))
    ctx.rotate(p.tilt)
    ctx.fillStyle = skin
    ctx.fillRect(-14, R * 0.7, 28, 40)
    drawHeadFront(ctx, p.who, R, p)
    ctx.restore()
  }
  ctx.restore()
}

/** Kalp çizimi (24 birimlik kutuda). */
export const HEART_PATH = 'M12 21.2C5.2 16 2.6 12.4 2.6 8.6 2.6 5.8 4.8 3.6 7.5 3.6c1.8 0 3.5 1 4.5 2.6 1-1.6 2.7-2.6 4.5-2.6 2.7 0 4.9 2.2 4.9 5 0 3.8-2.6 7.4-9.4 12.6z'
