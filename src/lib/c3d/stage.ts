import * as THREE from 'three'

export interface LightRig {
  key: string
  keyI: number
  keyPos: [number, number, number]
  rim: string
  rimI: number
  rimPos: [number, number, number]
  fill: string
  fillI: number
  sky: string
  ground: string
  hemiI: number
  exposure: number
}

/** Saydam zeminli 3D sahne: arka plan 2D katmanda çizilir, karakterler ve yakın nesneler burada. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly key = new THREE.DirectionalLight()
  readonly rim = new THREE.DirectionalLight()
  readonly fill = new THREE.DirectionalLight()
  readonly hemi = new THREE.HemisphereLight()
  readonly catcher: THREE.Mesh
  readonly w: number
  readonly h: number
  private envs = new Map<LightRig, THREE.Texture>()
  private pmrem: THREE.PMREMGenerator

  constructor(w = 720, h = 1280) {
    this.w = w
    this.h = h
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100)

    this.key.castShadow = true
    this.key.shadow.mapSize.set(1024, 1024)
    this.key.shadow.radius = 4
    this.key.shadow.bias = -0.0004
    const sc = this.key.shadow.camera
    sc.left = -4
    sc.right = 4
    sc.top = 4
    sc.bottom = -3
    sc.near = 0.5
    sc.far = 30
    this.scene.add(this.key, this.key.target, this.rim, this.fill, this.hemi)

    // ışığı yakalayan gölge zemini
    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.38, color: 0x1a1030 }))
    this.catcher.rotation.x = -Math.PI / 2
    this.catcher.receiveShadow = true
    this.scene.add(this.catcher)
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
  }

  setLights(r: LightRig) {
    this.key.color.set(r.key)
    this.key.intensity = r.keyI
    this.key.position.set(...r.keyPos)
    this.rim.color.set(r.rim)
    this.rim.intensity = r.rimI
    this.rim.position.set(...r.rimPos)
    this.fill.color.set(r.fill)
    this.fill.intensity = r.fillI
    this.fill.position.set(-4, 3, 5)
    this.hemi.color.set(r.sky)
    this.hemi.groundColor.set(r.ground)
    this.hemi.intensity = r.hemiI
    this.renderer.toneMappingExposure = r.exposure
    // yumuşak ortam yansıması: üst soğuk, alt sıcak (her ışık düzeni için bir kez üretilir)
    const cached = this.envs.get(r)
    if (cached) {
      this.scene.environment = cached
      return
    }
    const envScene = new THREE.Scene()
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(10, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { top: { value: new THREE.Color(r.sky) }, bot: { value: new THREE.Color(r.key) } },
        vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 bot; void main(){ float k = smoothstep(-6.0, 8.0, p.y); gl_FragColor = vec4(mix(bot, top, k), 1.0); }',
      }),
    )
    envScene.add(g)
    const env = this.pmrem.fromScene(envScene, 0.04).texture
    g.geometry.dispose()
    ;(g.material as THREE.Material).dispose()
    this.envs.set(r, env)
    this.scene.environment = env
    this.scene.environmentIntensity = 0.55
  }

  /** Dünya noktasının 2D tuvaldeki piksel konumu. */
  project(p: THREE.Vector3) {
    const v = p.clone().project(this.camera)
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h }
  }

  /** Işıkları sahnedeki hedef noktaya doğru gölge kamerası ile hizalar. */
  aim(x: number, y: number, z: number) {
    this.key.target.position.set(x, y, z)
    this.key.target.updateMatrixWorld()
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.dispose()
    for (const e of this.envs.values()) e.dispose()
    this.envs.clear()
  }
}

export const SUNSET: LightRig = {
  key: '#ffb26a', keyI: 3.0, keyPos: [4, 3.2, 3],
  rim: '#ff8f5a', rimI: 2.2, rimPos: [3, 2.5, -4],
  fill: '#7f8cff', fillI: 0.55,
  sky: '#9a86d8', ground: '#e8a27a', hemiI: 0.8, exposure: 1.1,
}

export const NIGHT: LightRig = {
  key: '#ffc27a', keyI: 2.4, keyPos: [-3, 3, 3.5],
  rim: '#6d86ff', rimI: 1.8, rimPos: [3, 2.5, -4],
  fill: '#ffb36b', fillI: 0.5,
  sky: '#59629e', ground: '#7a5538', hemiI: 0.7, exposure: 1.1,
}
