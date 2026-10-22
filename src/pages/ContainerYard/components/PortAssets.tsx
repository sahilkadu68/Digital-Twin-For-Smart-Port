import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TERMINAL_SURFACE_Y, type JNPATerminal } from '@/data/jnpa/portSpatial'
import type { RTGPlacement } from '@/data/jnpa/equipmentPlacement'

import { beam, quayFrame, type BoxSpec } from '../portMeshes'
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
const boxMaterial = new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0.22 })

export function InstancedBoxes({ boxes }: { boxes: BoxSpec[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const dummy = new THREE.Object3D(), color = new THREE.Color()
    boxes.forEach((b, i) => {
      dummy.position.set(...b.position); dummy.scale.set(...b.scale); dummy.rotation.set(...(b.rotation ?? [0, 0, 0]))
      dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix); ref.current!.setColorAt(i, color.set(b.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [boxes])
  return boxes.length ? <instancedMesh ref={ref} args={[boxGeometry, boxMaterial, boxes.length]} castShadow receiveShadow dispose={null} /> : null
}

export function QuayCranes({ terminal }: { terminal: JNPATerminal }) {
  const frame = quayFrame(terminal)
  const boxes = useMemo(() => {
    const result: BoxSpec[] = [], count = { BMCT: 16, NSFT: 6, NSICT: 6, NSIGT: 3, APMT: 6 }[terminal.id] ?? 0
    // Representative architectural repetitions, NOT stored equipment positions/counts.
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * terminal.quayLength / count, white = '#d8e7e8', accent = terminal.id === 'BMCT' ? '#50aaa5' : terminal.accent
      for (const side of [-1, 1]) {
        for (const z of [6, 31]) {
          result.push(beam([x + side * 13, 2, z], [x + side * 10, 58, z], 2.1, accent))
          result.push({ position: [x + side * 13, 3, z], scale: [4, 3, 7], color: '#243d47' })
        }
        result.push(beam([x + side * 10, 57, 6], [x + side * 10, 92, 19], 1.5, white))
        result.push(beam([x + side * 10, 92, 19], [x + side * 10, 57, 32], 1.5, white))
        result.push(beam([x + side * 10, 92, 19], [x + side * 10, 59, -67], 0.32, '#b9cccf'))
        result.push(beam([x + side * 10, 92, 19], [x + side * 10, 59, 48], 0.32, '#b9cccf'))
        result.push(beam([x + side * 10, 59, -67], [x + side * 10, 59, 48], 1.5, white))
      }
      result.push(beam([x - 13, 45, 6], [x + 13, 57, 6], 1.2, white))
      result.push(beam([x + 13, 45, 31], [x - 13, 57, 31], 1.2, white))
      result.push({ position: [x, 61, 26], scale: [22, 8, 17], color: accent })
      result.push({ position: [x + 12, 56, -5], scale: [5, 5, 5], color: '#244c64' })
      for (const side of [-1, 1]) result.push(beam([x + side * 4, 59, -39], [x + side * 4, 22, -39], 0.22, '#607986'))
      result.push({ position: [x, 22, -39], scale: [12, 1.5, 3], color: '#d5a847' })
    }
    return result
  }, [terminal])
  return <group position={frame.position} rotation={[0, frame.rotation, 0]}><InstancedBoxes boxes={boxes} /></group>
}

export function IllustrativeShip({ terminal, offset, length = 300, width = 43 }: { terminal: JNPATerminal; offset: number; length?: number; width?: number }) {
  const frame = quayFrame(terminal)
  const hull = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-length / 2, -width * 0.32); s.lineTo(-length / 2 + 20, -width / 2)
    s.lineTo(length / 2 - 38, -width / 2); s.lineTo(length / 2, 0)
    s.lineTo(length / 2 - 38, width / 2); s.lineTo(-length / 2 + 20, width / 2); s.lineTo(-length / 2, width * 0.32); s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: 12, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1, bevelSegments: 1, steps: 1 })
  }, [length, width])
  useEffect(() => () => hull.dispose(), [hull])
  const boxes = useMemo(() => {
    const items: BoxSpec[] = [
      { position: [-length * .32, 15, 0], scale: [23, 22, width * .7], color: '#e3ece9' },
      { position: [-length * .32, 27, 0], scale: [28, 5, width * .9], color: '#d1e1df' },
      { position: [-length * .32, 27, -width * .46], scale: [25, 2, 1], color: '#2a6179' },
      { position: [-length * .4, 28, 0], scale: [7, 10, 8], color: '#437e88' },
    ]
    const colors = ['#bd6647', '#527e96', '#d3b15e', '#458c86', '#c9d6cd']
    for (let bay = 0; bay < Math.floor((length - 100) / 13); bay++) for (let row = 0; row < 9; row++) for (let tier = 0; tier < 3; tier++) {
      items.push({ position: [-length * .2 + bay * 13, 6 + (tier + .5) * 2.591, (row - 4) * 3.2], scale: [12.192, 2.591, 2.438], color: colors[(bay * 3 + row + tier) % colors.length] })
    }
    items.push(beam([-length * .32, 27, 0], [-length * .32, 43, 0], .6, '#eef2e6'))
    return items
  }, [length, width])
  return <group position={frame.position} rotation={[0, frame.rotation, 0]}>
    <group position={[offset, 0, -width / 2 - 9]}>
      <mesh geometry={hull} position={[0, -7, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow><meshStandardMaterial color="#163d52" roughness={.65} /></mesh>
      <InstancedBoxes boxes={boxes} />
    </group>
  </group>
}

const tyreGeometry = new THREE.CylinderGeometry(.85,.85,.65,10)
const tyreMaterial = new THREE.MeshStandardMaterial({color:'#202d33',roughness:.95})
export function StoredRTGs({ terminal, locations }: { terminal: JNPATerminal; locations: RTGPlacement[] }) {
  const tyres = useRef<THREE.InstancedMesh>(null)
  const boxes = useMemo(() => locations.flatMap(({ position: [x, z], width, height, color }) => {
    const result: BoxSpec[] = []
    for (const side of [-1,1]) {
      for (const along of [-3,3]) result.push(beam([x+along,2,z+side*width/2],[x+along,height-1,z+side*width/2],.95,color))
      result.push({position:[x,1.6,z+side*width/2],scale:[9,1.1,1.5],color:'#40565d'})
      result.push(beam([x-3,4,z+side*width/2],[x+3,height-1,z+side*width/2],.35,'#d3e1dc'))
    }
    for (const along of [-3,3]) result.push({position:[x+along,height,z],scale:[1.3,1.8,width+2],color})
    result.push({position:[x,height+.9,z],scale:[7,1.4,4.2],color:'#d1dfd9'}) // trolley
    result.push({position:[x+4,height-1.7,z+width/2-2],scale:[2.5,2.8,2.5],color:'#2c576c'}) // cabin
    // Hoist stays above the tallest four-high HC stack (12.234m including bank).
    for (const end of [-5.5,5.5]) for (const side of [-1,1]) result.push(beam([x+end,height-1,z+side],[x+end,14.2,z+side],.08,'#45565d'))
    result.push({position:[x,14,z],scale:[12.2,.6,2.5],color:'#d6a940'})
    return result
  }), [locations])
  useLayoutEffect(()=>{
    if(!tyres.current)return
    const dummy=new THREE.Object3D();let i=0
    for(const p of locations)for(const side of [-1,1])for(const along of [-3.7,-2.1,2.1,3.7]){
      dummy.position.set(p.position[0]+along,.85,p.position[1]+side*p.width/2)
      dummy.rotation.set(Math.PI/2,0,0);dummy.updateMatrix();tyres.current.setMatrixAt(i++,dummy.matrix)
    }
    tyres.current.instanceMatrix.needsUpdate=true;tyres.current.computeBoundingSphere()
  },[locations])
  return <group name={'stored-rtgs-'+terminal.id} position={[terminal.x, TERMINAL_SURFACE_Y, terminal.z]} rotation={[0, terminal.rotation, 0]}>
    <InstancedBoxes boxes={boxes} />
    {locations.length>0&&<instancedMesh ref={tyres} args={[tyreGeometry,tyreMaterial,locations.length*8]} castShadow dispose={null}/>}
  </group>
}
