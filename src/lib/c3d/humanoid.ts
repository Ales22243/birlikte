import * as THREE from 'three'

export type Who = 'adem' | 'sena'

/** Karakterin yüz ifadesi. */
export interface Expr {
  blink: number
  mouth: number
  smile: number
  joy: number
  look: { x: number; y: number }
  brow: number
  squint: number
}

export const NEUTRAL: Expr = { blink: 0, mouth: 0, smile: 0.5, joy: 0, look: { x: 0, y: 0 }, brow: 0, squint: 0 }

export interface Limb {
  target: THREE.Vector3
  pole: THREE.Vector3
}

/** Karakterin gövdesel duruşu: tüm değerler karakter grubunun yerel (metre) koordinatındadır. */
export interface Pose3 {
  hip: THREE.Vector3
  torsoYaw: number
  torsoPitch: number
  torsoRoll: number
  headYaw: number
  headPitch: number
  headRoll: number
  armL: Limb
  armR: Limb
  legL: Limb
  legR: Limb
  /** Ayakların yere göre dönüklüğü (yaw) */
  footYaw: number
}

interface Dims {
  thigh: number
  shin: number
  torso: number
  neck: number
  R: number
  shoulder: number
  upper: number
  fore: number
  hipW: number
}

const DIMS: Record<Who, Dims> = {
  adem: { thigh: 0.46, shin: 0.45, torso: 0.5, neck: 0.1, R: 0.118, shoulder: 0.215, upper: 0.3, fore: 0.27, hipW: 0.1 },
  sena: { thigh: 0.43, shin: 0.42, torso: 0.46, neck: 0.1, R: 0.108, shoulder: 0.175, upper: 0.275, fore: 0.25, hipW: 0.09 },
}

const SKIN = { adem: '#f0c39c', sena: '#f6d3b8' }
const SKIRT = '#d9cab0'
const rnd = (seed: number) => {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}

function tex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Küre UV'sinde ön orta u=0.25; azimut φ (derece, +: ekranın sağı), yükselti e (derece, 0 = ekvator)
const U = (phi: number, w: number) => (0.25 + phi / 360) * w
const V = (e: number, h: number) => ((90 - e) / 180) * h

function smoothCurve(ctx: CanvasRenderingContext2D, pts: [number, number][], w: number, h: number, close = true) {
  const P = pts.map(([phi, e]) => [U(phi, w), V(e, h)] as [number, number])
  ctx.beginPath()
  ctx.moveTo(P[0][0], P[0][1])
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[Math.min(P.length - 1, i + 2)]
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    )
  }
  if (close) ctx.closePath()
}

// ---------- dokular ----------
function skinTexture(who: Who): THREE.CanvasTexture {
  return tex(1024, 512, (ctx, w, h) => {
    const base = SKIN[who]
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, base)
    g.addColorStop(1, who === 'adem' ? '#e5ad86' : '#efc2a3')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // yanak kızarıklığı
    for (const sd of [-1, 1]) {
      const cx = U(sd * 52, w)
      const cy = V(-12, h)
      const bg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 70)
      bg.addColorStop(0, who === 'adem' ? 'rgba(255,110,100,0.5)' : 'rgba(255,125,120,0.34)')
      bg.addColorStop(1, 'rgba(255,110,100,0)')
      ctx.fillStyle = bg
      ctx.fillRect(cx - 80, cy - 80, 160, 160)
    }
    // alın ve burun parlaması
    const sg = ctx.createRadialGradient(U(8, w), V(30, h), 2, U(8, w), V(30, h), 90)
    sg.addColorStop(0, 'rgba(255,255,255,0.14)')
    sg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sg
    ctx.fillRect(U(8, w) - 100, V(30, h) - 100, 200, 200)
    if (who === 'adem') {
      // fotoğraftaki gibi kısa ama dolgun, koyu kahve sakal ve bıyık
      const beard: [number, number][] = [
        [-92, 4], [-78, -4], [-58, -9], [-38, -12], [-20, -17], [-8, -19.5], [0, -18.5], [8, -19.5], [20, -17], [38, -12], [58, -9], [78, -4], [92, 4],
        [90, -30], [70, -62], [40, -84], [0, -90], [-40, -84], [-70, -62], [-90, -30],
      ]
      // zemin: çok hafif gri-kahve tonu, kenarları yumuşak
      ctx.save()
      smoothCurve(ctx, beard, w, h)
      ctx.clip()
      const bgrad = ctx.createLinearGradient(0, V(-4, h), 0, V(-70, h))
      bgrad.addColorStop(0, 'rgba(40,32,28,0.0)')
      bgrad.addColorStop(0.12, 'rgba(40,32,28,0.66)')
      bgrad.addColorStop(0.35, 'rgba(32,25,21,0.88)')
      bgrad.addColorStop(1, 'rgba(28,22,19,0.93)')
      ctx.fillStyle = bgrad
      ctx.fillRect(0, 0, w, h)
      // kıl dokusu: sık, koyu, yer yer açık tel
      for (let i = 0; i < 16000; i++) {
        const x = rnd(i * 3) * w
        const y = V(-4, h) + rnd(i * 5 + 1) * (V(-92, h) - V(-4, h))
        const k = (y - V(-4, h)) / (V(-92, h) - V(-4, h))
        if (rnd(i * 7 + 2) > 0.45 + k * 0.55) continue
        ctx.fillStyle = rnd(i) > 0.3 ? 'rgba(14,10,8,0.55)' : 'rgba(110,98,90,0.35)'
        ctx.fillRect(x, y, 1.6, 2.8)
      }
      ctx.restore()
    }
  })
}

function irisTexture(color: string): THREE.CanvasTexture {
  return tex(128, 128, (ctx, w) => {
    const c = w / 2
    const g = ctx.createRadialGradient(c, c, 4, c, c, c)
    g.addColorStop(0, '#ffffffaa')
    g.addColorStop(0.16, '#1a0f0a')
    g.addColorStop(0.2, color)
    g.addColorStop(0.62, color)
    g.addColorStop(0.9, '#2a1a10')
    g.addColorStop(1, '#150c08')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c, c, c, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,230,180,0.28)'
    ctx.lineWidth = 1.2
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(c + Math.cos(a) * c * 0.22, c + Math.sin(a) * c * 0.22)
      ctx.lineTo(c + Math.cos(a) * c * 0.62, c + Math.sin(a) * c * 0.62)
      ctx.stroke()
    }
  })
}

type Hairline = (phi: number) => number

function hairTexture(base: string, light: string, dark: string, hairline: Hairline, ombre: boolean): THREE.CanvasTexture {
  return tex(2048, 1024, (ctx, w, h) => {
    // saç bölgesi: her azimutta hairline(φ) üstü; küre dokusu sarıldığı için iki kopya çizilir
    const region = () => {
      ctx.beginPath()
      ctx.moveTo(U(-180, w), V(90, h))
      for (let phi = -180; phi <= 180; phi += 3) ctx.lineTo(U(phi, w), V(hairline(phi), h))
      ctx.lineTo(U(180, w), V(90, h))
      ctx.closePath()
    }
    for (const dx of [0, w]) {
      ctx.save()
      ctx.translate(dx, 0)
      region()
      ctx.clip()
      const g = ctx.createLinearGradient(0, 0, 0, h)
      if (ombre) {
        g.addColorStop(0, dark)
        g.addColorStop(0.45, base)
        g.addColorStop(1, light)
      } else {
        g.addColorStop(0, base)
        g.addColorStop(1, dark)
      }
      ctx.fillStyle = g
      ctx.fillRect(-w, 0, w * 3, h)
      for (let i = 0; i < 1800; i++) {
        const x = rnd(i * 7) * w * 1.5 - w * 0.25
        const y0 = rnd(i * 3 + 1) * h * 0.5
        const len = h * (0.2 + rnd(i * 5 + 2) * 0.5)
        ctx.strokeStyle = rnd(i) > 0.55 ? light : dark
        ctx.globalAlpha = 0.07 + rnd(i * 11) * 0.18
        ctx.lineWidth = 1 + rnd(i * 13) * 2.2
        ctx.beginPath()
        ctx.moveTo(x, y0)
        ctx.quadraticCurveTo(x + (rnd(i * 17) - 0.5) * 20, y0 + len * 0.5, x + (rnd(i * 19) - 0.5) * 30, y0 + len)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.restore()
    }
  })
}

// ---------- ana sınıf ----------
export class Humanoid {
  readonly who: Who
  readonly group = new THREE.Group()
  private d: Dims
  private torso = new THREE.Group()
  private head = new THREE.Group()
  private headMesh!: THREE.Mesh
  private upperArms: THREE.Mesh[] = []
  private foreArms: THREE.Mesh[] = []
  private sleeves: THREE.Mesh[] = []
  private hands: THREE.Group[] = []
  private thighs: THREE.Mesh[] = []
  private shins: THREE.Mesh[] = []
  private feet: THREE.Group[] = []
  private eyes: { ball: THREE.Group; lidU: THREE.Group; lidL: THREE.Group; side: number; lash: THREE.Mesh; happy: THREE.Mesh }[] = []
  private brows: THREE.Mesh[] = []
  private mouthTex!: THREE.CanvasTexture
  private mouthCtx!: CanvasRenderingContext2D
  private hairBack?: THREE.Group
  private nose!: THREE.Group
  skirt?: THREE.Mesh
  readonly sauce: THREE.Mesh
  private skinMat!: THREE.MeshPhysicalMaterial
  private flatSkin!: THREE.MeshPhysicalMaterial
  private shirtColor: string
  private pantsColor: string

  constructor(who: Who) {
    this.who = who
    this.d = DIMS[who]
    // fotoğraftaki kıyafetler: Adem açık gri uzun kollu tişört, Sena lacivert bluz
    this.shirtColor = who === 'adem' ? '#d4d4d0' : '#25366e'
    this.pantsColor = who === 'adem' ? '#3c4a66' : SKIRT
    this.group.add(this.torso)
    this.buildMaterials()
    this.buildTorso()
    this.buildHead()
    this.buildLimbs()
    this.sauce = new THREE.Mesh(new THREE.SphereGeometry(this.d.R * 0.07, 12, 10), new THREE.MeshStandardMaterial({ color: '#d63a30', roughness: 0.3 }))
    this.sauce.visible = false
    this.nose.add(this.sauce)
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }

  private buildMaterials() {
    this.skinMat = new THREE.MeshPhysicalMaterial({
      map: skinTexture(this.who), roughness: 0.52, metalness: 0, sheen: 0.8, sheenColor: new THREE.Color('#ffb59a'), sheenRoughness: 0.45,
      clearcoat: 0.12, clearcoatRoughness: 0.5,
    })
    this.flatSkin = new THREE.MeshPhysicalMaterial({
      color: this.who === 'adem' ? '#e8b08a' : '#f1c8aa', roughness: 0.52, sheen: 0.8, sheenColor: new THREE.Color('#ffb59a'), sheenRoughness: 0.45,
    })
  }

  private cloth(color: string, rough = 0.78) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
  }

  private buildTorso() {
    const d = this.d
    const adem = this.who === 'adem'
    // gövde: elips kesitli, omuzları yuvarlak
    const prof: THREE.Vector2[] = adem
      ? [[0.001, -0.02], [0.17, 0], [0.175, 0.1], [0.19, 0.24], [0.21, 0.38], [0.225, 0.46], [0.19, 0.51], [0.1, 0.545], [0.001, 0.55]].map(([x, y]) => new THREE.Vector2(x, y))
      : [[0.001, -0.02], [0.135, 0], [0.12, 0.1], [0.115, 0.2], [0.14, 0.32], [0.175, 0.42], [0.175, 0.47], [0.1, 0.5], [0.001, 0.51]].map(([x, y]) => new THREE.Vector2(x, y))
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), this.cloth(this.shirtColor, 0.72))
    body.scale.z = adem ? 0.62 : 0.6
    this.torso.add(body)
    // boyun ve yaka açıklığı
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(d.R * 0.5, d.R * 0.56, d.neck * 1.4, 20), this.flatSkin)
    neck.position.set(0, d.torso + d.neck * 0.3, 0)
    this.torso.add(neck)
    if (adem) {
      // bisiklet yaka
      const rib = new THREE.Mesh(new THREE.TorusGeometry(d.R * 0.6, 0.011, 8, 28), this.cloth('#c4c4c0', 0.8))
      rib.scale.z = 0.8
      rib.position.set(0, d.torso + 0.005, 0.005)
      rib.rotation.x = Math.PI / 2 - 0.18
      this.torso.add(rib)
    } else {
      // bluzun V yakası ve yaka kenarları
      for (const sd of [-1, 1]) {
        const lap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.012), this.cloth('#1d2c5e', 0.7))
        lap.position.set(sd * 0.032, d.torso - 0.05, 0.1)
        lap.rotation.set(-0.35, 0, sd * 0.42)
        this.torso.add(lap)
      }
      const v = new THREE.Mesh(new THREE.CircleGeometry(0.045, 3), this.flatSkin)
      v.scale.set(0.9, 1.4, 1)
      v.rotation.z = -Math.PI / 2
      v.position.set(0, d.torso - 0.03, 0.104)
      v.rotation.x = -0.3
      this.torso.add(v)
    }
    // pelvis: pantolon / etek
    if (adem) {
      const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.16, 28), this.cloth(this.pantsColor, 0.8))
      pelvis.scale.z = 0.66
      pelvis.position.y = -0.04
      this.torso.add(pelvis)
    } else {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.26, 0.42, 36, 1, true), this.cloth(SKIRT, 0.82))
      skirt.material.side = THREE.DoubleSide
      skirt.scale.z = 0.8
      skirt.position.y = -0.17
      this.torso.add(skirt)
      this.skirt = skirt
    }
  }

  private buildHead() {
    const d = this.d
    const R = d.R
    const adem = this.who === 'adem'
    const a = R * (adem ? 0.95 : 0.86)
    const b = R * (adem ? 1.08 : 1.14)
    const c = R * (adem ? 1.0 : 0.96)
    const geo = new THREE.SphereGeometry(1, 56, 42)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      let X = x * a
      let Y = y * b
      let Z = z * c
      if (y < 0) {
        const k = -y
        const jaw = adem ? 0.2 : 0.3
        X *= 1 - jaw * Math.pow(k, 1.7)
        Z *= 1 - 0.12 * k * k
        Y *= 1 + 0.05 * k
      }
      // dolgun yanaklar
      const cheek = Math.exp(-Math.pow((y + 0.2) / 0.35, 2)) * (z > -0.2 ? 1 : 0)
      X *= 1 + (adem ? 0.07 : 0.03) * cheek
      pos.setXYZ(i, X, Y, Z)
    }
    geo.computeVertexNormals()
    this.headMesh = new THREE.Mesh(geo, this.skinMat)
    this.head.add(this.headMesh)
    this.head.position.set(0, d.torso + d.neck + R * 0.92, 0.0)
    this.torso.add(this.head)
    this.head.updateMatrixWorld(true)

    const ray = new THREE.Raycaster()
    this.headMesh.updateWorldMatrix(true, false)
    const surf = (x: number, y: number) => {
      // ışını yerel uzaydan dünyaya çevirip kafa yüzeyine vurdurur, sonucu yerel z olarak döndürür
      const o = this.headMesh.localToWorld(new THREE.Vector3(x, y, R * 3))
      ray.set(o, new THREE.Vector3(0, 0, -1))
      const hit = ray.intersectObject(this.headMesh, false)[0]
      return hit ? this.headMesh.worldToLocal(hit.point.clone()).z : 0
    }

    // kulaklar
    for (const sd of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 14), this.flatSkin)
      ear.scale.set(R * 0.09, adem ? R * 0.25 : R * 0.21, R * 0.15)
      ear.position.set(sd * a * (adem ? 1.06 : 1.0), -R * 0.04, -R * 0.06)
      ear.rotation.y = sd * 0.3
      this.head.add(ear)
      if (!adem) {
        // küçük altın küpe
        const ring = new THREE.Mesh(new THREE.SphereGeometry(R * 0.045, 12, 10), new THREE.MeshStandardMaterial({ color: '#e8c36a', metalness: 0.9, roughness: 0.25 }))
        ring.position.set(sd * a * 1.0, -R * 0.2, -R * 0.02)
        this.head.add(ring)
      }
    }

    // gözler
    const eyeX = R * 0.37
    const eyeY = R * 0.06
    const eR = R * (adem ? 0.15 : 0.16)
    const irisTex = irisTexture(adem ? '#6e4524' : '#6b4a2a')
    for (const sd of [-1, 1]) {
      const zs = surf(sd * eyeX, eyeY)
      const eyeG = new THREE.Group()
      eyeG.position.set(sd * eyeX, eyeY, zs - eR * 0.55)
      const ball = new THREE.Group()
      const white = new THREE.Mesh(new THREE.SphereGeometry(eR, 20, 14), new THREE.MeshStandardMaterial({ color: '#f6f0ec', roughness: 0.25 }))
      ball.add(white)
      const iris = new THREE.Mesh(new THREE.CircleGeometry(eR * 0.66, 32), new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.3, polygonOffsetFactor: -2, polygonOffset: true }))
      iris.position.z = eR * 0.985
      ball.add(iris)
      const gloss = new THREE.Mesh(new THREE.SphereGeometry(eR * 1.02, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02 }))
      ball.add(gloss)
      const hl1 = new THREE.Mesh(new THREE.CircleGeometry(eR * 0.15, 14), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
      hl1.position.set(-eR * 0.24, eR * 0.3, eR * 1.015)
      ball.add(hl1)
      const hl2 = new THREE.Mesh(new THREE.CircleGeometry(eR * 0.07, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }))
      hl2.position.set(eR * 0.22, -eR * 0.24, eR * 1.015)
      ball.add(hl2)
      eyeG.add(ball)
      // göz kapakları
      const lidMat = new THREE.MeshPhysicalMaterial({ color: this.who === 'adem' ? '#eebd95' : '#f4cfb2', roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color('#ffb59a'), side: THREE.DoubleSide })
      const lidU = new THREE.Group()
      const capU = new THREE.Mesh(new THREE.SphereGeometry(eR * 1.09, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lidMat)
      lidU.add(capU)
      const lash = new THREE.Mesh(new THREE.TorusGeometry(eR * 1.07, adem ? eR * 0.07 : eR * 0.1, 6, 28, Math.PI), new THREE.MeshStandardMaterial({ color: adem ? '#2a1c14' : '#241510', roughness: 0.6 }))
      lash.rotation.set(Math.PI / 2, 0, Math.PI)
      lash.rotation.order = 'XYZ'
      lidU.add(lash)
      const lidL = new THREE.Group()
      const capL = new THREE.Mesh(new THREE.SphereGeometry(eR * 1.09, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidMat)
      lidL.add(capL)
      eyeG.add(lidU)
      eyeG.add(lidL)
      // gülerken kapanan göz: kalın ∩ kirpik çizgisi
      const happy = new THREE.Mesh(new THREE.TorusGeometry(eR * 0.72, eR * 0.13, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: adem ? '#2a1c14' : '#241510', roughness: 0.6 }))
      happy.position.set(0, -eR * 0.25, eR * 1.05)
      happy.scale.set(1, 0.8, 0.5)
      happy.visible = false
      eyeG.add(happy)
      this.head.add(eyeG)
      this.eyes.push({ ball, lidU, lidL, side: sd, lash, happy })
    }

    // kaşlar
    for (const sd of [-1, 1]) {
      const zb = surf(sd * eyeX, R * 0.38)
      const thick = adem ? R * 0.062 : R * 0.035
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-sd * R * 0.2, -R * 0.015, 0),
        new THREE.Vector3(-sd * R * 0.06, R * (adem ? 0.03 : 0.04), 0),
        new THREE.Vector3(sd * R * 0.1, R * (adem ? 0.04 : 0.06), 0),
        new THREE.Vector3(sd * R * 0.25, R * (adem ? 0.0 : -0.04), 0),
      ])
      const geoB = new THREE.TubeGeometry(curve, 16, thick, 8, false)
      const m = new THREE.Mesh(geoB, new THREE.MeshStandardMaterial({ color: adem ? '#241912' : '#4e3626', roughness: 0.7 }))
      m.scale.z = 0.55
      m.position.set(sd * eyeX, R * 0.36, zb + R * 0.012)
      m.rotation.y = sd * 0.1
      this.head.add(m)
      this.brows.push(m)
    }

    // burun
    this.nose = new THREE.Group()
    const noseY = -R * 0.2
    const zn = surf(0, noseY)
    this.nose.position.set(0, noseY, zn)
    const tipS = adem ? [R * 0.15, R * 0.12, R * 0.13] : [R * 0.09, R * 0.08, R * 0.09]
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), this.flatSkin)
    tip.scale.set(tipS[0], tipS[1], tipS[2])
    tip.position.set(0, 0, R * 0.04)
    this.nose.add(tip)
    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(adem ? R * 0.07 : R * 0.04, adem ? R * 0.32 : R * 0.28, 4, 10), this.flatSkin)
    bridge.position.set(0, R * 0.17, -R * 0.035)
    bridge.rotation.x = -0.12
    this.nose.add(bridge)
    for (const sd of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), this.flatSkin)
      wing.scale.set(R * (adem ? 0.075 : 0.055), R * 0.07, R * 0.07)
      wing.position.set(sd * R * (adem ? 0.12 : 0.09), -R * 0.03, R * 0.0)
      this.nose.add(wing)
    }
    this.head.add(this.nose)

    // ağız: kavisli yüzey üzerine boyanan, her karede güncellenen çıkartma
    const mw = R * 0.62
    const mh = R * 0.42
    const mouthY = -R * 0.5
    const pg = new THREE.PlaneGeometry(mw, mh, 24, 10)
    const pp = pg.attributes.position
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i)
      const y = pp.getY(i) + mouthY
      pp.setZ(i, surf(x, y) + R * 0.006)
    }
    pg.computeVertexNormals()
    const mc = document.createElement('canvas')
    mc.width = 384
    mc.height = 256
    this.mouthCtx = mc.getContext('2d')!
    this.mouthTex = new THREE.CanvasTexture(mc)
    this.mouthTex.colorSpace = THREE.SRGBColorSpace
    const mm = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: this.mouthTex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false }))
    mm.position.set(0, mouthY, 0)
    this.head.add(mm)

    // saç
    this.buildHair(a, b, c)
  }

  private buildHair(a: number, b: number, c: number) {
    const R = this.d.R
    if (this.who === 'adem') {
      // M saç çizgisi: şakaklar geride, merkez hafif öne
      const E: Hairline = (phi) => {
        const p = Math.abs(phi)
        // geniş, yüksek alın; şakaklar belirgin geride
        if (p <= 15) return 58
        if (p <= 40) return 58 + ((p - 15) / 25) * 10
        if (p <= 58) return 68 - ((p - 40) / 18) * 30
        if (p <= 75) return 38 - ((p - 58) / 17) * 26
        if (p <= 95) return 12 - ((p - 75) / 20) * 8
        return 4 - ((p - 95) / 85) * 30
      }
      const map = hairTexture('#2a1f19', '#4a3a30', '#17110d', E, false)
      const mat = new THREE.MeshPhysicalMaterial({ map, transparent: true, alphaTest: 0.5, roughness: 0.5, sheen: 0.25, sheenColor: new THREE.Color('#5a4434'), sheenRoughness: 0.6 })
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), mat)
      shell.scale.set(a * 1.1, b * 1.1, c * 1.1)
      shell.position.y = R * 0.015
      this.head.add(shell)
      // saç hacmi: geriye taranmış, hafif kabarık kısa saç
      const hm = new THREE.MeshPhysicalMaterial({ color: '#2a1f19', roughness: 0.5, sheen: 0.25, sheenColor: new THREE.Color('#5a4434'), sheenRoughness: 0.5 })
      const clump = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, rz = 0) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), hm)
        m.scale.set(sx, sy, sz)
        m.position.set(x, y, z)
        m.rotation.set(rx, 0, rz)
        this.head.add(m)
      }
      // tepe hacmi kabuğun içine gömülü durur, yalnızca hafif bir kabarıklık verir (kenarı bere gibi taşmaz)
      clump(a * 0.8, b * 0.5, c * 0.72, 0, b * 0.72, -c * 0.3, -0.1)
      clump(a * 0.46, R * 0.16, c * 0.4, 0, b * 0.98, c * 0.12, -0.4)
    } else {
      const E: Hairline = (phi) => {
        const p = Math.abs(phi)
        if (p <= 4) return 58
        if (p <= 20) return 46 - ((p - 4) / 16) * 26
        if (p <= 45) return 20 - ((p - 20) / 25) * 22
        if (p <= 80) return -2 - ((p - 45) / 35) * 22
        return -24 - ((p - 80) / 100) * 18
      }
      const map = hairTexture('#c9a066', '#ead19c', '#5e4330', E, true)
      const mat = new THREE.MeshPhysicalMaterial({ map, transparent: true, alphaTest: 0.5, roughness: 0.42, sheen: 0.35, sheenColor: new THREE.Color('#c99a5a'), sheenRoughness: 0.4 })
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), mat)
      shell.scale.set(a * 1.05, b * 1.06, c * 1.06)
      shell.position.y = R * 0.01
      this.head.add(shell)
      // omuzlara uzanan düz uzun saç: arkaya sarılan, uçları daralan yumuşak hacim
      const back = new THREE.Group()
      const hairMapLong = hairTexture('#c9a066', '#efd8a6', '#7a5a3c', () => -90, true)
      const longMat = new THREE.MeshPhysicalMaterial({ map: hairMapLong, roughness: 0.44, sheen: 0.35, sheenColor: new THREE.Color('#c99a5a'), side: THREE.DoubleSide })
      const prof: THREE.Vector2[] = [
        [0.3, 0.75], [0.9, 0.62], [1.12, 0.1], [1.2, -0.7], [1.18, -1.8], [1.1, -2.9], [0.98, -3.7], [0.82, -4.2],
      ].map(([r, y]) => new THREE.Vector2(r * R, y * R))
      const cloak = new THREE.Mesh(new THREE.LatheGeometry(prof, 28, Math.PI * 0.42, Math.PI * 1.16), longMat)
      const cp = cloak.geometry.attributes.position
      for (let i = 0; i < cp.count; i++) {
        // uç kesimi dalgalı ve hafif sivri
        const x = cp.getX(i)
        const y = cp.getY(i)
        const z = cp.getZ(i)
        if (y < -3.2 * R) {
          const k = (Math.abs(x) / (R * 1.2)) ** 2
          cp.setY(i, y - (1 - k) * 0.5 * R + Math.sin(x * 40) * 0.08 * R)
        }
        cp.setZ(i, z * 0.7)
      }
      cloak.geometry.computeVertexNormals()
      cloak.position.set(0, 0, -R * 0.05)
      back.add(cloak)
      // yüzün iki yanından göğse düşen saç
      for (const sd of [-1, 1]) {
        const lock = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.2, R * 3.3, 6, 14), longMat)
        lock.scale.z = 0.45
        lock.position.set(sd * R * 0.9, -R * 2.0, R * 0.02)
        lock.rotation.z = sd * 0.04
        back.add(lock)
      }
      this.head.add(back)
      this.hairBack = back
    }
  }

  private buildLimbs() {
    const d = this.d
    const adem = this.who === 'adem'
    const skin = this.flatSkin
    const capsule = (r: number, len: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat)
      return m
    }
    const armR = adem ? 0.036 : 0.03
    for (let i = 0; i < 2; i++) {
      const up = capsule(armR * (adem ? 1.4 : 1.1), d.upper - armR * 2, adem ? this.cloth(this.shirtColor, 0.74) : skin)
      const fo = capsule(armR * (adem ? 1.25 : 0.92), d.fore - armR * 2, adem ? this.cloth(this.shirtColor, 0.74) : skin)
      const sl = capsule(armR * 1.55, d.upper * 0.55, this.cloth(this.shirtColor, 0.74))
      this.group.add(up, fo, sl)
      this.upperArms.push(up)
      this.foreArms.push(fo)
      this.sleeves.push(sl)
      const hand = new THREE.Group()
      const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), skin)
      palm.scale.set(armR * 1.45, armR * 1.9, armR * 0.95)
      palm.position.y = -armR * 1.5
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), skin)
      thumb.scale.set(armR * 0.55, armR * 1.0, armR * 0.55)
      thumb.position.set(armR * 1.2, -armR * 1.0, armR * 0.2)
      hand.add(palm, thumb)
      this.group.add(hand)
      this.hands.push(hand)
    }
    const legCol = adem ? this.pantsColor : '#f4cfb2'
    const legR = adem ? 0.064 : 0.05
    for (let i = 0; i < 2; i++) {
      const th = capsule(legR * 1.12, d.thigh - legR * 2, adem ? this.cloth(this.pantsColor, 0.8) : this.flatSkin.clone())
      const sh = capsule(legR * 0.92, d.shin - legR * 2, this.cloth(adem ? this.pantsColor : legCol, 0.8))
      this.group.add(th, sh)
      this.thighs.push(th)
      this.shins.push(sh)
      const foot = new THREE.Group()
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), this.cloth(adem ? '#f4f0ea' : '#ece2d2', 0.5))
      shoe.scale.set(0.05, 0.045, 0.125)
      shoe.position.set(0, 0.04, 0.045)
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.24), this.cloth('#d9d2c6', 0.7))
      sole.position.set(0, 0.012, 0.04)
      foot.add(shoe, sole)
      this.group.add(foot)
      this.feet.push(foot)
    }
  }

  // ---------- animasyon ----------
  private static up = new THREE.Vector3(0, 1, 0)

  private place(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
    const mid = a.clone().add(b).multiplyScalar(0.5)
    mesh.position.copy(mid)
    const dir = b.clone().sub(a).normalize()
    mesh.quaternion.setFromUnitVectors(Humanoid.up, dir)
  }

  private ik(S: THREE.Vector3, T: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3) {
    const d = T.clone().sub(S)
    const dist = Math.min(Math.max(d.length(), 0.001), l1 + l2 - 0.002)
    const dir = d.clone().normalize()
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
    const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)))
    if (p.lengthSq() < 1e-6) p.set(0, 0, 1)
    p.normalize()
    const E = S.clone().add(dir.clone().multiplyScalar(a)).add(p.multiplyScalar(h))
    const end = S.clone().add(dir.multiplyScalar(dist))
    return { E, end }
  }

  update(pose: Pose3, expr: Expr, t: number) {
    const d = this.d
    const adem = this.who === 'adem'
    // gövde
    this.torso.position.copy(pose.hip)
    this.torso.rotation.set(pose.torsoPitch, pose.torsoYaw, pose.torsoRoll, 'YXZ')
    this.torso.updateMatrix()
    if (this.skirt) {
      // otururken etek kalçada toplanır; uylukları elbise rengindeki bacak örter
      const seated = pose.hip.y < 0.6
      this.skirt.scale.set(seated ? 0.78 : 1, seated ? 0.3 : 1, seated ? 0.62 : 0.8)
      this.skirt.position.y = seated ? -0.03 : -0.17
      for (const th of this.thighs) {
        const m = th.material as THREE.MeshPhysicalMaterial
        m.color.set(seated ? SKIRT : '#f1c8aa')
        m.sheen = seated ? 0 : 0.8
        th.scale.set(seated ? 1.35 : 1, 1, seated ? 1.35 : 1)
      }
    }
    this.head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ')

    const toGroup = (v: THREE.Vector3) => v.clone().applyMatrix4(this.torso.matrix)
    // omuzlar (L = ekranın solu = -x)
    const shL = toGroup(new THREE.Vector3(-d.shoulder, d.torso - 0.045, 0))
    const shR = toGroup(new THREE.Vector3(d.shoulder, d.torso - 0.045, 0))
    const arms: [THREE.Vector3, Limb][] = [[shL, pose.armL], [shR, pose.armR]]
    arms.forEach(([S, limb], i) => {
      const { E, end } = this.ik(S, limb.target, d.upper, d.fore, limb.pole)
      this.place(this.upperArms[i], S, E)
      this.place(this.foreArms[i], E, end)
      const slEnd = S.clone().lerp(E, 0.6)
      this.place(this.sleeves[i], S, slEnd)
      this.sleeves[i].visible = true
      this.hands[i].position.copy(end)
      const dir = end.clone().sub(E).normalize()
      this.hands[i].quaternion.setFromUnitVectors(Humanoid.up.clone().negate(), dir)
    })

    // bacaklar
    const hipsL = toGroup(new THREE.Vector3(-d.hipW, -0.03, 0))
    const hipsR = toGroup(new THREE.Vector3(d.hipW, -0.03, 0))
    const legs: [THREE.Vector3, Limb][] = [[hipsL, pose.legL], [hipsR, pose.legR]]
    legs.forEach(([S, limb], i) => {
      const { E, end } = this.ik(S, limb.target, d.thigh, d.shin, limb.pole)
      this.place(this.thighs[i], S, E)
      this.place(this.shins[i], E, end)
      const foot = this.feet[i]
      foot.position.set(end.x, end.y - 0.04, end.z)
      foot.rotation.set(0, pose.footYaw, 0)
    })

    // yüz
    this.updateFace(expr, adem)
    if (this.hairBack) {
      const sway = Math.sin(t * 1.7) * 0.03
      this.hairBack.rotation.x = sway * 0.4 + pose.headPitch * -0.2
      this.hairBack.rotation.z = Math.sin(t * 1.3 + 1) * 0.02
    }
  }

  private updateFace(e: Expr, adem: boolean) {
    const R = this.d.R
    const happy = e.joy > 0.5
    const closed = Math.max(e.blink, happy ? 1 : 0, e.squint * 0.7)
    for (const eye of this.eyes) {
      eye.ball.rotation.set(-e.look.y * 0.35, e.look.x * 0.5, 0)
      const open = adem ? -0.35 : -0.55
      eye.lidU.rotation.x = open + (1.52 - open) * Math.min(1, closed)
      eye.lidL.rotation.x = 1.0 + (-1.1 - 1.0) * Math.min(1, happy ? 0.55 : e.squint * 0.5 + (closed > 0.9 ? 0.5 : 0))
      eye.happy.visible = happy
      eye.lash.visible = !happy
      eye.ball.visible = !happy
    }
    for (let i = 0; i < 2; i++) {
      const b = this.brows[i]
      b.position.y = R * (adem ? 0.33 : 0.31) + e.brow * R * 0.07 + e.joy * R * 0.05
      b.rotation.z = (i === 0 ? 1 : -1) * e.brow * -0.1
    }
    // ağız çıkartması
    const ctx = this.mouthCtx
    const w = 384
    const h = 256
    ctx.clearRect(0, 0, w, h)
    const open = Math.min(1.4, e.mouth)
    const smile = Math.max(0, Math.min(1, e.smile + e.joy * 0.5))
    const cx = w / 2
    const cy = h * 0.5
    const mw = w * (0.36 + smile * 0.06 + e.joy * 0.05)
    const lipCol = adem ? '#d98e84' : '#d9737a'
    const lipDark = adem ? '#c2766d' : '#c25a62'
    const corner = smile * 20
    if (open < 0.1) {
      // kapalı, dolgun dudaklı gülümseme (fotoğraftaki gibi)
      const lw = mw * 0.82
      const dip = 6 + corner * 0.5
      const seam = (x: number) => cy - corner + (1 - ((x - cx) / lw) ** 2) * (corner + dip)
      // üst dudak: ortada hafif yay
      ctx.fillStyle = lipDark
      ctx.beginPath()
      ctx.moveTo(cx - lw, seam(cx - lw))
      ctx.quadraticCurveTo(cx - lw * 0.5, cy - 30 + corner * 0.2, cx - lw * 0.12, cy - 26 + corner * 0.4)
      ctx.quadraticCurveTo(cx, cy - 20 + corner * 0.4, cx + lw * 0.12, cy - 26 + corner * 0.4)
      ctx.quadraticCurveTo(cx + lw * 0.5, cy - 30 + corner * 0.2, cx + lw, seam(cx + lw))
      ctx.quadraticCurveTo(cx, seam(cx) + 4, cx - lw, seam(cx - lw))
      ctx.fill()
      // alt dudak: daha dolgun
      ctx.fillStyle = lipCol
      ctx.beginPath()
      ctx.moveTo(cx - lw * 0.96, seam(cx - lw))
      ctx.quadraticCurveTo(cx, seam(cx) + 2, cx + lw * 0.96, seam(cx + lw))
      ctx.quadraticCurveTo(cx + lw * 0.55, seam(cx) + 44, cx, seam(cx) + 46)
      ctx.quadraticCurveTo(cx - lw * 0.55, seam(cx) + 44, cx - lw * 0.96, seam(cx - lw))
      ctx.fill()
      // dudak çizgisi ve parlama
      ctx.lineCap = 'round'
      ctx.strokeStyle = adem ? '#7e3f38' : '#8f343c'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(cx - lw, seam(cx - lw))
      ctx.quadraticCurveTo(cx, seam(cx) + 6, cx + lw, seam(cx + lw))
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(cx - lw * 0.3, seam(cx) + 26)
      ctx.quadraticCurveTo(cx, seam(cx) + 32, cx + lw * 0.3, seam(cx) + 26)
      ctx.stroke()
    } else {
      const hh = 14 + open * 68
      const top = cy - corner - 4
      ctx.fillStyle = '#5a1f26'
      ctx.beginPath()
      ctx.moveTo(cx - mw, top)
      ctx.quadraticCurveTo(cx, top - 8, cx + mw, top)
      ctx.quadraticCurveTo(cx + mw * 0.9, top + hh * 1.3, cx, top + hh * 1.45)
      ctx.quadraticCurveTo(cx - mw * 0.9, top + hh * 1.3, cx - mw, top)
      ctx.fill()
      ctx.save()
      ctx.clip()
      ctx.fillStyle = '#fbf7f2'
      ctx.fillRect(cx - mw, top - 2, mw * 2, 20 + open * 6)
      ctx.fillStyle = '#d96a72'
      ctx.beginPath()
      ctx.ellipse(cx, top + hh * 1.15, mw * 0.55, hh * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = lipDark
      ctx.lineWidth = 11
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - mw, top)
      ctx.quadraticCurveTo(cx, top - 10, cx + mw, top)
      ctx.stroke()
      ctx.strokeStyle = lipCol
      ctx.lineWidth = 9
      ctx.beginPath()
      ctx.moveTo(cx - mw, top)
      ctx.quadraticCurveTo(cx + mw * 0.9, top + hh * 1.3, cx, top + hh * 1.45)
      ctx.quadraticCurveTo(cx - mw * 0.9, top + hh * 1.3, cx - mw, top)
      ctx.stroke()
    }
    this.mouthTex.needsUpdate = true
  }

  /** Sosu burnun ucunda göster/gizle. */
  setSauce(on: boolean) {
    this.sauce.visible = on
    this.sauce.position.set(0, -this.d.R * 0.05, this.d.R * 0.2)
  }

  /** Verilen duruşta ağzın önündeki noktanın grup koordinatı (eli ağza götürmek için). */
  mouthIn(pose: Pose3, forward = 1.0): THREE.Vector3 {
    const R = this.d.R
    const m = new THREE.Matrix4().compose(pose.hip, new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.torsoPitch, pose.torsoYaw, pose.torsoRoll, 'YXZ')), new THREE.Vector3(1, 1, 1))
    const h = new THREE.Matrix4().compose(this.head.position, new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ')), new THREE.Vector3(1, 1, 1))
    return new THREE.Vector3(0, -R * 0.5, R * forward).applyMatrix4(h).applyMatrix4(m)
  }

  /** Elin (0 = L, 1 = R) grup koordinatı: son `update` sonrası. */
  hand(i: number) {
    return this.hands[i].position.clone()
  }

  /** Kafa merkezinin dünya konumu (matrisler güncel olmalı). */
  headWorld(out: THREE.Vector3) {
    return this.head.getWorldPosition(out)
  }

  get dims() {
    return this.d
  }
}
