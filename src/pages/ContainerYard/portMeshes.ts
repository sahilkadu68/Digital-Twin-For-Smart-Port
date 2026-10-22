import * as THREE from 'three'
import type { JNPATerminal, Point } from '@/data/jnpa/portSpatial'

export interface BoxSpec { position: [number, number, number]; scale: [number, number, number]; color: string; rotation?: [number, number, number] }

export function beam(a: [number, number, number], b: [number, number, number], width: number, color: string): BoxSpec {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start)
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()))
  return { position: start.add(end).multiplyScalar(0.5).toArray() as [number, number, number],
    scale: [width, delta.length(), width], rotation: [rotation.x, rotation.y, rotation.z], color }
}

export function quayFrame(t: JNPATerminal) {
  const [a, b] = t.quay, angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  return { position: [a[0], 0, a[1]] as [number, number, number], rotation: -angle }
}

export function surfaceGeometry(points: Point[], depth = 0) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)))
  const geometry = depth > 0
    ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 })
    : new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  if (depth > 0) geometry.translate(0, -depth, 0)
  return geometry
}
export function stripGeometry(lines: Point[][], width: number, y: number) {
  const positions: number[] = []
  for (const points of lines) for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], d = Math.hypot(bx - ax, bz - az)
    if (!d) continue
    const x = -(bz - az) / d * width / 2, z = (bx - ax) / d * width / 2
    positions.push(ax + x,y,az + z, bx + x,y,bz + z, ax - x,y,az - z,
      bx + x,y,bz + z, bx - x,y,bz - z, ax - x,y,az - z)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals()
  return geometry
}
