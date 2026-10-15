import * as THREE from 'three'
import { Stage, SUNSET } from './stage'
import { Humanoid, NEUTRAL, type Pose3 } from './humanoid'
export { THREE }
export { Stage, SUNSET, Humanoid, NEUTRAL }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export function standPose(h: Humanoid): Pose3 {
  const d = h.dims
  const hipY = d.thigh + d.shin - 0.02
  return {
    hip: V(0, hipY, 0), torsoYaw: 0, torsoPitch: 0, torsoRoll: 0, headYaw: 0, headPitch: 0, headRoll: 0,
    armL: { target: V(-d.shoulder - 0.03, hipY + d.torso - 0.5, 0.06), pole: V(0, -0.2, -1) },
    armR: { target: V(d.shoulder + 0.03, hipY + d.torso - 0.5, 0.06), pole: V(0, -0.2, -1) },
    legL: { target: V(-d.hipW, 0.04, 0.02), pole: V(0, 0, 1) },
    legR: { target: V(d.hipW, 0.04, 0.02), pole: V(0, 0, 1) },
    footYaw: 0,
  }
}

export function testScene(doc: Document) {
  doc.body.innerHTML = ''
  doc.body.style.cssText = 'margin:0;background:#c98a6a'
  const st = new Stage(720, 1280)
  st.setLights(SUNSET)
  const c = st.renderer.domElement
  c.style.cssText = 'position:fixed;left:0;top:0;height:100vh;'
  doc.body.appendChild(c)
  const A = new Humanoid('adem')
  const S = new Humanoid('sena')
  A.group.position.set(-0.42, 0, 0)
  S.group.position.set(0.42, 0, 0)
  st.scene.add(A.group, S.group)
  A.update(standPose(A), { ...NEUTRAL, smile: 0.7 }, 1)
  S.update(standPose(S), { ...NEUTRAL, smile: 0.7 }, 1)
  st.aim(0, 1, 0)
  return { st, A, S }
}
