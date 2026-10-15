import * as THREE from 'three'
import { DUSK, NIGHT, Stage, SUNSET, type LightRig } from './stage'
import { Humanoid, NEUTRAL, type Expr, type Limb, type Pose3 } from './humanoid'

export type SceneKind = 'chairs' | 'walk' | 'shack'

const TAU = Math.PI * 2
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
const pulse = (t: number, a: number, b: number, fade = 0.5) => smooth((t - a) / fade) * smooth((b - t) / fade)
const mix = (a: THREE.Vector3, b: THREE.Vector3, k: number) => a.clone().lerp(b, k)

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

const blinkOf = (t: number, off: number) => {
  const period = 3.2
  const k = ((t + off) % period) / period
  const w = 0.045
  return k > 1 - w ? Math.sin(((k - (1 - w)) / w) * Math.PI) : 0
}

const limb = (target: THREE.Vector3, pole: THREE.Vector3): Limb => ({ target, pole })

/** Dürüm yeme döngüsü (2D sürümle aynı zamanlama). */
function eatCycle(d: number, offset: number, from: number, to: number) {
  const per = 2.4
  const k = ((d + offset) % per) / per
  const active = d > from && d < to ? 1 : 0
  const reach = active * smooth(Math.sin(k * TAU - Math.PI / 2) * 0.5 + 0.5)
  const chew = active && k > 0.55 && k < 0.95 ? Math.sin(d * 22) * 0.5 + 0.5 : 0
  const progress = clamp01((d - from) / (to - from)) * 0.55
  return { reach, mouth: (reach > 0.8 ? 0.7 : 0) + chew * 0.35, chew, progress }
}

interface Wrap {
  g: THREE.Group
  top: THREE.Group
}

/** Dünyayı (3D sahne + iki karakter + sahne nesneleri) taşır; her çağrıda belirtilen sahneyi çizer. */
export class World {
  readonly stage: Stage
  readonly adem = new Humanoid('adem')
  readonly sena = new Humanoid('sena')
  private props: Record<SceneKind, THREE.Group> = { chairs: new THREE.Group(), walk: new THREE.Group(), shack: new THREE.Group() }
  private current: SceneKind | null = null
  private wraps: Wrap[] = []
  private glasses: THREE.Group[] = []
  private rigs: Record<SceneKind, LightRig> = { chairs: SUNSET, walk: SUNSET, shack: NIGHT }
  /** Son çizilen karede kadeh tokuşturma noktası (ekran pikseli), yoksa null. */
  clink: { x: number; y: number } | null = null

  constructor(w = 720, h = 1280) {
    this.stage = new Stage(w, h)
    this.stage.scene.add(this.adem.group, this.sena.group)
    for (const k of ['chairs', 'walk', 'shack'] as SceneKind[]) {
      this.stage.scene.add(this.props[k])
      this.props[k].visible = false
    }
    this.buildChairs()
    this.buildShack()
    this.props.chairs.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
    this.props.shack.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
  }

  // ---------- nesneler ----------
  private buildChairs() {
    const g = this.props.chairs
    const wood = new THREE.MeshStandardMaterial({ color: '#8a5a35', roughness: 0.7 })
    const stripeTex = (c1: string) =>
      canvasTex(256, 256, (c, w, h) => {
        c.fillStyle = '#fff6e6'
        c.fillRect(0, 0, w, h)
        c.fillStyle = c1
        for (let i = 0; i < 6; i++) c.fillRect(i * (w / 6) + w / 24, 0, w / 12, h)
      })
    const mkChair = (x: number, color: string) => {
      const ch = new THREE.Group()
      ch.position.set(x, 0, 0)
      const fabric = new THREE.MeshStandardMaterial({ map: stripeTex(color), roughness: 0.85, side: THREE.DoubleSide })
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, 0.5), fabric)
      seat.position.set(0, 0.34, -0.05)
      seat.rotation.x = 0.14
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.03), fabric)
      back.position.set(0, 0.64, 0.24)
      back.rotation.x = 0.4
      ch.add(seat, back)
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.72, 0.03), wood)
        post.position.set(sx * 0.28, 0.64, 0.26)
        post.rotation.x = 0.4
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.03), wood)
        leg.position.set(sx * 0.28, 0.2, -0.22)
        leg.rotation.x = -0.35
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.5), wood)
        arm.position.set(sx * 0.3, 0.52, 0.0)
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), wood)
        brace.position.set(sx * 0.28, 0.22, 0.2)
        brace.rotation.x = 0.5
        ch.add(post, leg, arm, brace)
      }
      g.add(ch)
    }
    mkChair(-0.45, '#2f7fb8')
    mkChair(0.45, '#e2566b')
    // küçük yan masa ve çay bardakları
    const table = new THREE.Group()
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), new THREE.MeshStandardMaterial({ color: '#b98557', roughness: 0.6 }))
    top.position.y = 0.44
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.44, 12), wood)
    post.position.y = 0.22
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 20), wood)
    foot.position.y = 0.015
    table.add(top, post, foot)
    table.position.set(0, 0, -0.14)
    g.add(table)
    for (const dx of [-0.045, 0.045]) {
      const gl = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.022, 0.08, 18, 1, true),
        new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide }),
      )
      const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.02, 0.06, 18), new THREE.MeshStandardMaterial({ color: '#b8481a', roughness: 0.3, emissive: '#5a1d05', emissiveIntensity: 0.4 }))
      tea.position.y = -0.008
      gl.add(body, tea)
      gl.position.set(dx, 0.495, -0.2)
      g.add(gl)
    }
    // kumdaki terlikler
    const flip = new THREE.MeshStandardMaterial({ color: '#4aa3c8', roughness: 0.6 })
    for (const [x, z, r] of [[-0.78, -0.95, 0.3], [-0.6, -1.0, -0.2], [0.5, -0.98, 0.15], [0.7, -0.92, -0.35]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 16), flip)
      f.scale.z = 2.2
      f.position.set(x, 0.008, z)
      f.rotation.y = r
      g.add(f)
    }
  }

  private buildShack() {
    const g = this.props.shack
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4a31', roughness: 0.8 })
    // masa: mavi kareli naylon örtü
    const cloth = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#eef3f8'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#4d86c4'
      const n = 8
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2 === 0) c.fillRect((x * w) / n, (y * h) / n, w / n, h / n)
    })
    cloth.repeat.set(3, 1.2)
    const clothMat = new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.45 })
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.035, 0.72), clothMat)
    top.position.set(0, 0.76, 0.5)
    // örtünün sarkan kısa kenarı; altında ahşap ayaklar görünür
    const drape = cloth.clone()
    drape.repeat.set(3, 0.4)
    const drapeMat = new THREE.MeshStandardMaterial({ map: drape, roughness: 0.45 })
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.02), drapeMat)
    front.position.set(0, 0.67, 0.86)
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.72), drapeMat)
    sideL.position.set(-0.85, 0.67, 0.5)
    const sideR = sideL.clone()
    sideR.position.x = 0.85
    g.add(top, front, sideL, sideR)
    for (const [x, z] of [[-0.78, 0.2], [0.78, 0.2], [-0.78, 0.8], [0.78, 0.8]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), wood)
      leg.position.set(x, 0.3, z)
      g.add(leg)
    }
    // tabureler
    for (const x of [-0.35, 0.35]) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#d9d1c3', roughness: 0.6 }))
      seat.position.set(x, 0.43, -0.02)
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.43, 10), wood)
      leg.position.set(x, 0.21, -0.02)
      g.add(seat, leg)
    }
    // ayran bardakları
    const cupMat = new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.4 })
    const bandMat = new THREE.MeshStandardMaterial({ color: '#d33a3a', roughness: 0.5 })
    const mkCup = () => {
      const gl = new THREE.Group()
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.1, 18), cupMat)
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0408, 0.0372, 0.028, 18), bandMat)
      const foam = new THREE.Mesh(new THREE.CircleGeometry(0.037, 18), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }))
      foam.rotation.x = -Math.PI / 2
      foam.position.y = 0.046
      gl.add(cup, band, foam)
      return gl
    }
    for (const x of [-0.72, 0.72]) {
      const c = mkCup()
      c.position.set(x, 0.83, 0.55)
      g.add(c)
    }
    // ortada patates kızartması ve limonlar
    const box = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.08, 4), new THREE.MeshStandardMaterial({ color: '#d94c3d', roughness: 0.6 }))
    box.position.set(0, 0.818, 0.6)
    box.rotation.y = Math.PI / 4
    g.add(box)
    const fryMat = new THREE.MeshStandardMaterial({ color: '#f1c04b', roughness: 0.6 })
    for (let i = 0; i < 11; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), fryMat)
      f.position.set((i - 5) * 0.01, 0.87, 0.6 + ((i * 7) % 3 - 1) * 0.012)
      f.rotation.z = (i - 5) * 0.07
      g.add(f)
    }
    const lemonMat = new THREE.MeshStandardMaterial({ color: '#ffe36a', roughness: 0.5 })
    for (const x of [-0.24, 0.24]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10, 0, Math.PI), lemonMat)
      l.rotation.x = -Math.PI / 2
      l.position.set(x, 0.78, 0.68)
      g.add(l)
    }
    // dürümler: kâğıt + üst kısım (lavaş ve iç)
    for (let i = 0; i < 2; i++) {
      const w = new THREE.Group()
      const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.033, 0.1, 16), new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.8 }))
      paper.position.y = 0.05
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0372, 0.0352, 0.014, 16), new THREE.MeshStandardMaterial({ color: '#d94c3d' }))
      stripe.position.y = 0.06
      const top = new THREE.Group()
      top.position.y = 0.1
      const lavash = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.037, 0.08, 16), new THREE.MeshStandardMaterial({ color: '#f0d49b', roughness: 0.75 }))
      lavash.position.y = 0.04
      const fill1 = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), new THREE.MeshStandardMaterial({ color: '#6fbf5f', roughness: 0.7 }))
      fill1.position.set(0, 0.08, 0)
      fill1.scale.y = 0.55
      const fill2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: '#e5503a', roughness: 0.5 }))
      fill2.position.set(0.012, 0.09, 0.01)
      const fish = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshStandardMaterial({ color: '#f3e3cf', roughness: 0.6 }))
      fish.position.set(-0.012, 0.088, -0.004)
      top.add(lavash, fill1, fill2, fish)
      w.add(paper, stripe, top)
      g.add(w)
      this.wraps.push({ g: w, top })
    }
    // şerefe için ayran bardağı
    for (let i = 0; i < 2; i++) {
      const gl = mkCup()
      gl.visible = false
      g.add(gl)
      this.glasses.push(gl)
    }
  }

  // ---------- duruşlar ----------
  /** Karakter yüz ifadesi taslağı: göz kırpma ve kayma bakışı dahil. */
  private expr(t: number, off: number, o: Partial<Expr> = {}): Expr {
    return { ...NEUTRAL, blink: blinkOf(t, off), ...o, look: o.look ?? { x: 0, y: 0 } }
  }

  private setScene(kind: SceneKind) {
    if (this.current === kind) return
    this.current = kind
    for (const k of Object.keys(this.props) as SceneKind[]) this.props[k].visible = k === kind
    this.stage.setLights(this.rigs[kind])
  }

  /** 1. sahne: arkadan, şezlongda denize bakarlar; sonra birbirine döner, el ele tutuşup gülerler. */
  private poseChairs(t: number) {
    const turnA = smooth((t - 4.8) / 1.2)
    const turnS = smooth((t - 4.4) / 1.2)
    const reach = smooth((t - 5.6) / 1.4)
    const laugh = pulse(t, 8.2, 10.2, 0.4)
    const wind = Math.sin(t * 2.1) * 0.01
    const breathe = Math.sin(t * 1.6) * 0.006
    const mk = (who: 'adem' | 'sena', turn: number, cx: number): Pose3 => {
      // inner: sevgiliye doğru dünya x yönü
      const inner = who === 'adem' ? 1 : -1
      const yaw = Math.PI - inner * 0.32 * turn
      const hip = V(0, 0.42 + breathe + Math.abs(Math.sin(t * 15)) * 0.012 * laugh, -0.06)
      // gövdenin yerel -x'i dünyada (-cos yaw, sin yaw): şezlongda (yaw≈π) dünya +x
      const lIsPlusX = -Math.cos(yaw) > 0
      // iç el: önce kolçakta, sonra masanın üstünde sevgilinin eliyle buluşur
      const rest = V(inner * 0.3, 0.55, -0.02)
      const meet = V(-cx - inner * 0.03, 0.62 + Math.sin(t * 2) * 0.01, -0.06)
      const innerT = mix(rest, meet, reach)
      const innerL = limb(innerT, V(inner * 0.4, -0.6, 0.5))
      const outer = limb(V(-inner * 0.3, 0.55, -0.02), V(-inner * 0.6, -0.4, 0.5))
      const plusX = inner === 1 ? innerL : outer
      const minusX = inner === 1 ? outer : innerL
      const sideX = (lx: number) => (lIsPlusX ? -lx : lx)
      return {
        hip,
        torsoYaw: yaw,
        torsoPitch: -0.2 + laugh * 0.08 * Math.sin(t * 9),
        torsoRoll: wind,
        headYaw: -inner * turn * 1.15,
        headPitch: 0.06 - laugh * 0.15,
        headRoll: inner * turn * 0.1,
        armL: lIsPlusX ? plusX : minusX,
        armR: lIsPlusX ? minusX : plusX,
        legL: limb(V(sideX(-0.12), 0.06, -0.74), V(0, 1, -0.2)),
        legR: limb(V(sideX(0.12), 0.06, -0.74), V(0, 1, -0.2)),
        footYaw: Math.PI,
      }
    }
    this.adem.group.position.set(-0.45, 0, 0)
    this.sena.group.position.set(0.45, 0, 0)
    this.adem.setSauce(false)
    this.sena.setSauce(false)
    this.adem.update(mk('adem', turnA, -0.45), this.expr(t, 0.4, { smile: 0.6 + turnA * 0.3, joy: laugh, mouth: laugh * 1.1, look: { x: -turnA * 0.35, y: 0.05 } }), t)
    this.sena.update(mk('sena', turnS, 0.45), this.expr(t, 1.4, { smile: 0.6 + turnS * 0.3, joy: laugh, mouth: laugh * 1.0, look: { x: turnS * 0.35, y: 0.05 } }), t)
    const st = this.stage
    const k = smooth(t / 12.6)
    st.camera.fov = 38
    st.camera.position.set(0.1 - k * 0.1, 1.6 - k * 0.15, 5.3 - k * 0.8)
    st.camera.lookAt(0, 0.98, -0.3)
    st.camera.updateProjectionMatrix()
    st.aim(0, 0.6, 0)
  }

  /** 2. sahne: el ele, kameraya yan dönük yürürler (zemin 2D'de akar), ara ara birbirine bakarlar. */
  private poseWalk(t: number) {
    const yaw = 0.28
    const f = V(Math.sin(yaw), 0, Math.cos(yaw))
    const s = V(Math.cos(yaw), 0, -Math.sin(yaw))
    const gap = 0.29
    const joy = pulse(t, 18.6, 21.4, 0.6)
    const glance = 0.65 + 0.35 * Math.sin(t * 0.9)
    const hold = V(0, 0, 0)
    const mk = (h: Humanoid, side: 1 | -1, phase: number): Pose3 => {
      const d = h.dims
      const ph = t * TAU * 0.92 + phase
      const base = (d.thigh + d.shin) * 0.95
      const hip = V(0, base + Math.cos(ph * 2) * 0.012 + Math.abs(Math.sin(t * 15)) * 0.02 * joy, 0)
      const foot = (sig: number) => {
        const p = ph + (sig < 0 ? 0 : Math.PI)
        const fw = Math.sin(p) * 0.2
        const lift = Math.max(0, Math.cos(p)) * 0.07
        return limb(s.clone().multiplyScalar(sig * d.hipW).add(f.clone().multiplyScalar(fw)).setY(0.045 + lift), f.clone().add(V(0, 0.3, 0)))
      }
      const shoulderY = hip.y + d.torso - 0.045
      const armSwing = (sig: number) => {
        const p = ph + (sig < 0 ? Math.PI : 0)
        return limb(
          s.clone().multiplyScalar(sig * (d.shoulder + 0.05)).add(f.clone().multiplyScalar(Math.sin(p) * 0.14 + 0.03)).setY(shoulderY - d.upper - d.fore + 0.08),
          f.clone().multiplyScalar(-1).add(s.clone().multiplyScalar(sig * 0.4)),
        )
      }
      // tutuşan eller: ikisinin arasında, kalça hizasında
      const holdLocal = hold.clone().sub(h.group.position).add(f.clone().multiplyScalar(0.08 + Math.sin(ph) * 0.03)).setY(0.8 + Math.sin(ph * 2) * 0.01)
      const holdLimb = limb(holdLocal, f.clone().multiplyScalar(-0.6).add(V(0, -0.3, 0)).add(s.clone().multiplyScalar(-side)))
      // gövdenin yerel -x'i dünyada -s
      const toward = side === 1 ? -1 : 1 // sevgiliye doğru s işareti
      const armMinusS = toward === -1 ? holdLimb : armSwing(-1)
      const armPlusS = toward === 1 ? holdLimb : armSwing(1)
      const look = toward * glance
      return {
        hip,
        torsoYaw: yaw + toward * 0.12 * glance,
        torsoPitch: 0.04,
        torsoRoll: Math.sin(ph) * 0.03,
        headYaw: look * (side === 1 ? 1.0 : 0.72),
        headPitch: (side === 1 ? -0.12 : 0.1) * glance - joy * 0.12,
        headRoll: -toward * 0.08 * glance,
        armL: armMinusS,
        armR: armPlusS,
        legL: foot(-1),
        legR: foot(1),
        footYaw: yaw,
      }
    }
    // Adem s'nin eksi tarafında (solda, biraz önde), Sena artı tarafında
    this.adem.group.position.copy(s.clone().multiplyScalar(-gap))
    this.sena.group.position.copy(s.clone().multiplyScalar(gap))
    this.adem.setSauce(false)
    this.sena.setSauce(false)
    this.adem.update(mk(this.adem, -1, 0), this.expr(t, 0.4, { smile: 0.85, joy: joy, mouth: 0.25 + joy * 0.8, look: { x: 0.35 * glance, y: 0.1 } }), t)
    this.sena.update(mk(this.sena, 1, Math.PI * 0.12), this.expr(t, 1.4, { smile: 0.85, joy: joy, mouth: 0.25 + joy * 0.8, look: { x: -0.35 * glance, y: 0.15 } }), t)
    const st = this.stage
    const k = smooth((t - 11.4) / 16.4)
    // gün batımından alacakaranlığa
    st.mixLights(SUNSET, DUSK, k)
    st.camera.fov = 30
    st.camera.position.set(0.2 - k * 0.4, 1.15, 6.2 - k * 0.5)
    st.camera.lookAt(0, 1.12, 0)
    st.camera.updateProjectionMatrix()
    st.aim(0, 0.8, 0)
  }

  /** 3. sahne: balıkçıda masada karşılıklı değil yan yana, kameraya dönük; dürüm, kahkaha, şerefe. */
  private poseShack(t: number) {
    const d = t - 26.6
    const eatA = eatCycle(d, 0, 1.3, 5.6)
    const eatS = eatCycle(d, 0.9, 1.6, 5.4)
    const laughA = smooth((d - 6.0) / 0.7) * smooth((14.2 - d) / 1.2)
    const laughS = smooth((d - 7.1) / 0.7) * smooth((14.2 - d) / 1.2)
    const cheers = pulse(d, 14.6, 17.0, 0.5)
    const sauce = d > 5.2 && d < 13.4
    const point = pulse(d, 5.3, 7.6, 0.3)
    const xs = { adem: -0.35, sena: 0.35 }
    const clinkW = V(0, 1.08, 0.36)
    const mk = (h: Humanoid, inner: 1 | -1, eat: ReturnType<typeof eatCycle>, laugh: number, ph: number, wi: number) => {
      const wobble = Math.sin(t * 3.4 + ph)
      const pose: Pose3 = {
        hip: V(0, 0.47 + Math.abs(Math.sin(t * 16 + ph)) * 0.014 * laugh, 0),
        torsoYaw: inner * (0.18 + cheers * 0.1),
        torsoPitch: 0.1 - laugh * (0.18 + 0.1 * wobble),
        torsoRoll: -inner * laugh * 0.06 * wobble,
        headYaw: inner * (0.12 + cheers * 0.35 + (inner === 1 ? point * 0.4 : 0)),
        headPitch: 0.05 + eat.chew * 0.04 * Math.sin(d * 22) - laugh * (0.28 + 0.08 * wobble),
        headRoll: -inner * laugh * 0.12 * wobble,
        armL: limb(V(0, 0, 0), V(0, 0, 0)),
        armR: limb(V(0, 0, 0), V(0, 0, 0)),
        legL: limb(V(-0.12, 0.06, 0.4), V(0, 1, 0.3)),
        legR: limb(V(0.12, 0.06, 0.4), V(0, 1, 0.3)),
        footYaw: 0,
      }
      // iç el: dürümü masadan ağza götürür, şerefede bardağı ortada buluşturur
      const mouth = h.mouthIn(pose, 1.25).add(V(0, -0.11, 0.05))
      const rest = V(inner * 0.14, 0.86, 0.34)
      const lift = V(inner * 0.1, 0.95, 0.32)
      const clinkLocal = clinkW.clone().sub(h.group.position).add(V(-inner * 0.045, 0, 0))
      let innerT = mix(mix(rest, lift, laugh > 0.01 ? 0.5 * laugh : Math.min(1, eat.reach * 2)), mouth, eat.reach)
      innerT = mix(innerT, clinkLocal, cheers)
      // Adem dürümü tutan eliyle Sena'nın burnundaki sosu gösterir
      if (inner === 1) innerT = mix(innerT, V(0.46, 1.1, 0.3), point)
      const innerL = limb(innerT, V(-inner * 0.2, -1, -0.3))
      // dış el: masada durur; gülerken karnını tutar
      const outerRest = V(-inner * 0.24, 0.8, 0.32)
      const belly = V(-inner * 0.05, 0.62, 0.18)
      const outerL = limb(mix(outerRest, belly, laugh), V(-inner * 0.6, -0.8, -0.2))
      // yaw≈0'da yerel -x = dünya -x
      pose.armL = inner === 1 ? outerL : innerL
      pose.armR = inner === 1 ? innerL : outerL
      return { pose, mouth, wi }
    }
    this.adem.group.position.set(xs.adem, 0, 0)
    this.sena.group.position.set(xs.sena, 0, 0)
    const A = mk(this.adem, 1, eatA, laughA, 0, 0)
    const S = mk(this.sena, -1, eatS, laughS, 1.3, 1)
    this.adem.setSauce(false)
    this.sena.setSauce(sauce)
    this.adem.update(
      A.pose,
      this.expr(t, 0.4, { smile: 0.7, mouth: Math.max(eatA.mouth * (1 - laughA), laughA * 1.25, cheers * 0.5, point * 0.45), joy: Math.max(laughA, cheers * 0.5), look: { x: 0.2 + point * 0.4 + cheers * 0.3, y: 0 } }),
      t,
    )
    this.sena.update(
      S.pose,
      this.expr(t, 1.4, { smile: 0.75, mouth: Math.max(eatS.mouth * (1 - laughS), laughS * 1.25, cheers * 0.5), joy: Math.max(laughS, cheers * 0.5), look: { x: -0.2 - cheers * 0.3, y: 0 } }),
      t,
    )
    // dürümler ve bardaklar elde
    const items: [Humanoid, number, number, number][] = [
      [this.adem, 1, eatA.reach, eatA.progress],
      [this.sena, 0, eatS.reach, eatS.progress],
    ]
    items.forEach(([h, hand, reach, eaten], i) => {
      const hp = h.hand(hand).add(h.group.position)
      const w = this.wraps[i]
      w.g.visible = cheers < 0.05
      const mouthW = (i === 0 ? A : S).mouth.clone().add(h.group.position).add(V(0, 0.11, -0.05))
      const toMouth = mouthW.sub(hp).normalize()
      const dir = V(0, 1, 0).lerp(toMouth, reach * 0.9).normalize()
      w.g.position.copy(hp).add(dir.clone().multiplyScalar(-0.04))
      w.g.quaternion.setFromUnitVectors(V(0, 1, 0), dir)
      w.top.scale.y = 1 - eaten * 0.7
      const gl = this.glasses[i]
      gl.visible = cheers >= 0.05
      gl.position.copy(hp).add(V(0, 0.04, 0))
      gl.rotation.set(0, 0, (i === 0 ? -1 : 1) * 0.15 * cheers)
    })
    const st = this.stage
    const k = smooth(d / 17.8)
    st.camera.fov = 34
    // kapanışta kamera yavaşça geri çekilir, üstte başlığa yer açılır
    const back = smooth((d - 16.2) / 4.2)
    st.camera.position.set(0, 1.36 - k * 0.04 + back * 0.2, 3.9 - k * 0.45 + back * 1.5)
    st.camera.lookAt(0, 1.3 + back * 0.35, 0.1)
    st.camera.updateProjectionMatrix()
    st.aim(0, 0.9, 0.2)
    const meet = this.glasses[0].position.clone().add(this.glasses[1].position).multiplyScalar(0.5).add(V(0, 0.05, 0))
    this.clink = d > 15.5 && d < 15.95 ? st.project(meet) : null
  }

  /** Verilen sahneyi çizer ve 3D tuvali döndürür. `t` küresel saniye. */
  render(kind: SceneKind, t: number): HTMLCanvasElement {
    this.setScene(kind)
    this.clink = null
    if (kind === 'chairs') this.poseChairs(t)
    else if (kind === 'walk') this.poseWalk(t)
    else this.poseShack(t)
    this.stage.render()
    return this.stage.renderer.domElement
  }

  /** Karakterin kafasının ekran konumu (konuşma balonu kuyruğu için). */
  headScreen(who: 'adem' | 'sena') {
    const h = who === 'adem' ? this.adem : this.sena
    const p = new THREE.Vector3()
    h.group.updateMatrixWorld(true)
    h.headWorld(p)
    return this.stage.project(p)
  }

  dispose() {
    this.stage.dispose()
  }
}
