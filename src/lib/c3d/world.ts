import * as THREE from 'three'
import { NIGHT, Stage, SUNSET, type LightRig } from './stage'
import { Humanoid, NEUTRAL, type Expr, type Limb, type Pose3 } from './humanoid'

export type SceneKind = 'chairs' | 'walk' | 'shack'

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
const pulse = (t: number, a: number, b: number, fade = 0.5) => smooth((t - a) / fade) * smooth((b - t) / fade)

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

/** Dünyayı (3D sahne + iki karakter + sahne nesneleri) taşır; her çağrıda belirtilen sahneyi çizer. */
export class World {
  readonly stage: Stage
  readonly adem = new Humanoid('adem')
  readonly sena = new Humanoid('sena')
  private props: Record<SceneKind, THREE.Group> = { chairs: new THREE.Group(), walk: new THREE.Group(), shack: new THREE.Group() }
  private current: SceneKind | null = null
  private wraps: THREE.Group[] = []
  private glasses: THREE.Group[] = []
  private rigs: Record<SceneKind, LightRig> = { chairs: SUNSET, walk: SUNSET, shack: NIGHT }

  constructor(w = 720, h = 1280) {
    this.stage = new Stage(w, h)
    this.stage.scene.add(this.adem.group, this.sena.group)
    for (const k of ['chairs', 'walk', 'shack'] as SceneKind[]) this.stage.scene.add(this.props[k])
    this.buildChairs()
    this.buildShack()
    for (const g of [this.props.chairs, this.props.shack]) g.visible = false
    this.props.walk.visible = false
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
      return back
    }
    mkChair(-0.62, '#2f7fb8')
    mkChair(0.62, '#e2566b')
    // küçük yan masa ve çay bardakları
    const table = new THREE.Group()
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 28), new THREE.MeshStandardMaterial({ color: '#b98557', roughness: 0.6 }))
    top.position.y = 0.5
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 12), wood)
    post.position.y = 0.25
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 20), wood)
    foot.position.y = 0.015
    table.add(top, post, foot)
    table.position.set(0, 0, -0.1)
    g.add(table)
    for (const dx of [-0.1, 0.1]) {
      const gl = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.022, 0.08, 18, 1, true),
        new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide }),
      )
      const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.02, 0.06, 18), new THREE.MeshStandardMaterial({ color: '#b8481a', roughness: 0.3, emissive: '#5a1d05', emissiveIntensity: 0.4 }))
      tea.position.y = -0.008
      gl.add(body, tea)
      gl.position.set(dx, 0.56, -0.1)
      g.add(gl)
    }
  }

  private buildShack() {
    const g = this.props.shack
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4a31', roughness: 0.8 })
    // masa: ahşap üst + mavi kareli naylon örtü
    const cloth = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#eef3f8'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#4d86c4'
      const n = 8
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2 === 0) c.fillRect((x * w) / n, (y * h) / n, w / n, h / n)
    })
    cloth.repeat.set(3, 1.2)
    const clothMat = new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.55 })
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.035, 0.72), clothMat)
    top.position.set(0, 0.76, 0.52)
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.02), clothMat)
    front.position.set(0, 0.45, 0.87)
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.72), clothMat)
    sideL.position.set(-0.85, 0.45, 0.52)
    const sideR = sideL.clone()
    sideR.position.x = 0.85
    g.add(top, front, sideL, sideR)
    // taburelere benzer sandalyeler
    for (const x of [-0.4, 0.4]) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#d9d1c3', roughness: 0.6 }))
      seat.position.set(x, 0.43, -0.02)
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.43, 10), wood)
      leg.position.set(x, 0.21, -0.02)
      g.add(seat, leg)
    }
    // ayran bardakları, patates, limon
    for (const x of [-0.7, 0.7]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 18), new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.4 }))
      cup.position.set(x, 0.835, 0.56)
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0455, 0.0415, 0.03, 18), new THREE.MeshStandardMaterial({ color: '#d33a3a' }))
      band.position.set(x, 0.835, 0.56)
      g.add(cup, band)
    }
    const fries = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.09, 4), new THREE.MeshStandardMaterial({ color: '#d94c3d', roughness: 0.6 }))
    fries.position.set(0, 0.83, 0.62)
    fries.rotation.y = Math.PI / 4
    g.add(fries)
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), new THREE.MeshStandardMaterial({ color: '#f1c04b', roughness: 0.6 }))
      f.position.set((i - 4) * 0.012, 0.9, 0.62)
      f.rotation.z = (i - 4) * 0.06
      g.add(f)
    }
    // dürümler
    for (let i = 0; i < 2; i++) {
      const w = new THREE.Group()
      const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.1, 16), new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.8 }))
      paper.position.y = -0.04
      const lavash = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#f0d49b', roughness: 0.75 }))
      lavash.position.y = 0.06
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0355, 0.014, 16), new THREE.MeshStandardMaterial({ color: '#d94c3d' }))
      stripe.position.y = -0.005
      const fill1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshStandardMaterial({ color: '#6fbf5f', roughness: 0.7 }))
      fill1.position.set(0, 0.125, 0)
      fill1.scale.y = 0.6
      const fill2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: '#e5503a', roughness: 0.5 }))
      fill2.position.set(0.012, 0.135, 0.01)
      w.add(paper, lavash, stripe, fill1, fill2)
      g.add(w)
      this.wraps.push(w)
    }
    // ayran bardağı (şerefe)
    for (let i = 0; i < 2; i++) {
      const gl = new THREE.Group()
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 18), new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.4 }))
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0455, 0.0415, 0.03, 18), new THREE.MeshStandardMaterial({ color: '#d33a3a' }))
      gl.add(cup, band)
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

  private poseChairs(t: number) {
    const turnA = smooth((t - 4.8) / 1.2)
    const turnS = smooth((t - 4.4) / 1.2)
    const laugh = pulse(t, 8.2, 10.2, 0.4)
    const wind = Math.sin(t * 2.1) * 0.01
    const mk = (who: 'adem' | 'sena', turn: number): Pose3 => {
      const inner = who === 'adem' ? 1 : -1
      const hip = V(0, 0.4, 0.03)
      const hold = V(-inner * 0.0 + 0, 0.66, -0.1)
      // eller: iç el masanın üzerinde birleşir (grup yerel koordinatı = dünya - sandalye konumu)
      const holdLocal = hold.clone().sub(V(inner === 1 ? -0.62 : 0.62, 0, 0))
      const outer = limb(V(-inner * 0.33, 0.52, -0.1), V(-inner * 0.6, -0.2, 0.6))
      const innerL = limb(holdLocal, V(inner * 0.5, -0.5, 0.6))
      return {
        hip, torsoYaw: Math.PI, torsoPitch: -0.3 + laugh * 0.04, torsoRoll: wind, headYaw: inner * -turn * 1.15, headPitch: 0.1 - turn * 0.05, headRoll: inner * turn * 0.08,
        armL: inner === 1 ? outer : innerL, armR: inner === 1 ? innerL : outer,
        legL: limb(V(-0.1, 0.07, -0.72), V(0, 1, -0.1)), legR: limb(V(0.1, 0.07, -0.72), V(0, 1, -0.1)), footYaw: Math.PI,
      }
    }
    this.adem.group.position.set(-0.62, 0, 0)
    this.sena.group.position.set(0.62, 0, 0)
    this.adem.update(mk('adem', turnA), this.expr(t, 0.4, { smile: 0.6 + turnA * 0.3, joy: laugh * 0.5, mouth: laugh * 0.9, look: { x: -turnA * 0.3, y: 0 } }), t)
    this.sena.update(mk('sena', turnS), this.expr(t, 1.4, { smile: 0.6 + turnS * 0.3, joy: laugh * 0.5, mouth: laugh * 0.9, look: { x: turnS * 0.3, y: 0 } }), t)
    const st = this.stage
    const k = smooth(t / 12.6)
    st.camera.position.set(0, 1.62 - k * 0.04, 4.3 - k * 0.5)
    st.camera.lookAt(0, 1.0, -0.2)
    st.aim(0, 0.8, 0)
  }

  /** Verilen sahneyi çizer ve 3D tuvali döndürür. `t` küresel saniye. */
  render(kind: SceneKind, t: number): HTMLCanvasElement {
    this.setScene(kind)
    if (kind === 'chairs') this.poseChairs(t)
    this.stage.render()
    return this.stage.renderer.domElement
  }

  get lightRigs() {
    return this.rigs
  }

  dispose() {
    this.stage.dispose()
  }
}
