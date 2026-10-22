import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import roadsUrl from '../../../../jnpa_roads_candidate.geojson?url'
import { BMCT_RAIL, MANGROVES, PORT_LAND, QUAY_LINKS, RAIL_SPINE, SHEVA_HILL, TANK_FARM, projectGeo, type Point } from '@/data/jnpa/portSpatial'
import { intersectsInspectionScope } from '@/data/jnpa/roadDisplayScope'
import type { LineString, MultiLineString } from 'geojson'
import { InstancedBoxes } from './PortAssets'
import { surfaceGeometry, stripGeometry, beam, type BoxSpec } from '../portMeshes'

function inside([x, z]: Point, polygon: Point[]) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result
  }
  return result
}

function Water() {
  const material = useRef<THREE.ShaderMaterial>(null)
  useFrame((_, delta) => { if (material.current) material.current.uniforms.time.value += delta })
  const uniforms = useMemo(() => ({ time: { value: 0 } }), [])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
    <planeGeometry args={[50000, 50000]} />
    <shaderMaterial ref={material} uniforms={uniforms}
      vertexShader="varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.0);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}"
      fragmentShader="uniform float time; varying vec3 world; void main(){float w=sin(world.x*.002+world.z*.0035+time*.12)*sin(world.z*.0018-time*.08);float glint=pow(max(0.0,sin(world.x*.009+world.z*.013+time*.08)),14.0);vec3 c=mix(vec3(.075,.255,.33),vec3(.16,.43,.48),.5+.12*w);c+=vec3(.06,.08,.08)*glint*.08;gl_FragColor=vec4(c,1.0);}" />
  </mesh>
}

function CoastalTerrain() {
  // Top stays at Y=0; the solid skirt reaches below water (-2m). This is
  // illustrative reclamation thickness, not measured bathymetry or elevation.
  const land = useMemo(() => surfaceGeometry(PORT_LAND, 5), [])
  const marsh = useMemo(() => surfaceGeometry(MANGROVES), [])
  const piers = useMemo(() => stripGeometry(QUAY_LINKS,12,1), [])
  const hill = useMemo(() => {
    const cx = SHEVA_HILL.reduce((s,p) => s + p[0], 0) / SHEVA_HILL.length
    const cz = SHEVA_HILL.reduce((s,p) => s + p[1], 0) / SHEVA_HILL.length
    const vertices: number[] = []
    // Illustrative relief, not an elevation survey. Edge follows mapped hill area.
    for (let ring = 0; ring < 5; ring++) for (let i = 0; i < SHEVA_HILL.length; i++) {
      const a = SHEVA_HILL[i], b = SHEVA_HILL[(i + 1) % SHEVA_HILL.length]
      const point = (p: Point, t: number) => [cx + (p[0] - cx) * t, 1 + 48 * (1 - t * t), cz + (p[1] - cz) * t]
      const p = point(a, ring / 5), q = point(b, ring / 5), r = point(a, (ring + 1) / 5), s = point(b, (ring + 1) / 5)
      vertices.push(...p,...q,...r,...q,...s,...r)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); g.computeVertexNormals(); return g
  }, [])
  useEffect(()=>()=>{land.dispose();marsh.dispose();piers.dispose();hill.dispose()},[land,marsh,piers,hill])
  return <>
    <mesh geometry={land} position={[0, 0, 0]} receiveShadow><meshStandardMaterial color="#9aab8e" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={marsh} position={[0, .15, 0]} receiveShadow><meshStandardMaterial color="#507666" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={piers} receiveShadow><meshStandardMaterial color="#b5c2bd" roughness={.9} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={hill} receiveShadow><meshStandardMaterial color="#708b58" roughness={1} side={THREE.DoubleSide} flatShading /></mesh>
  </>
}

function Vegetation() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const points = useMemo(() => {
    const result: Point[] = []
    for (const area of [MANGROVES]) {
      const minX = Math.min(...area.map(p=>p[0])), maxX = Math.max(...area.map(p=>p[0]))
      const minZ = Math.min(...area.map(p=>p[1])), maxZ = Math.max(...area.map(p=>p[1]))
      for (let x = minX; x < maxX; x += 85) for (let z = minZ; z < maxZ; z += 85) if (inside([x,z],area)) result.push([x,z])
    }
    return result
  }, [])
  useEffect(() => {
    if (!ref.current) return
    const dummy = new THREE.Object3D(), color = new THREE.Color()
    points.forEach(([x,z],i) => {
      dummy.position.set(x,7,z); dummy.scale.setScalar(.75 + (i % 5) * .08); dummy.updateMatrix()
      ref.current!.setMatrixAt(i,dummy.matrix); ref.current!.setColorAt(i,color.set(i % 3 === 0 ? '#54795c' : '#3c6956'))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [points])
  return <instancedMesh ref={ref} args={[undefined,undefined,points.length]}><coneGeometry args={[26,15,6]} /><meshStandardMaterial roughness={1} /></instancedMesh>
}

function ReferenceRoads({ onError }: { onError: (message: string) => void }) {
  const [lines, setLines] = useState<{ major: Point[][]; local: Point[][] }>({ major: [], local: [] })
  useEffect(() => {
    const controller = new AbortController()
    fetch(roadsUrl,{signal:controller.signal}).then(async r => {
      if (!r.ok) throw new Error(`Road context unavailable (${r.status})`)
      return r.json()
    }).then(data => {
      if (controller.signal.aborted) return
      const major: Point[][] = [], local: Point[][] = []
      for (const f of data.features) {
        const g = f.geometry as LineString | MultiLineString
        if (!['LineString','MultiLineString'].includes(g.type) || !intersectsInspectionScope(g)) continue
        const bucket = /^(motorway|trunk|primary|secondary)/.test(f.properties?.highway ?? '') ? major : local
        for (const line of g.type === 'LineString' ? [g.coordinates] : g.coordinates) bucket.push(line.map(p=>projectGeo(p[0],p[1])))
      }
      setLines({major,local})
    }).catch(e=>{if(!controller.signal.aborted)onError(e instanceof Error?e.message:'Road context unavailable')})
    return ()=>controller.abort()
  },[onError])
  const major = useMemo(()=>stripGeometry(lines.major,11,1.08),[lines.major])
  const local = useMemo(()=>stripGeometry(lines.local,5,1.06),[lines.local])
  const marking = useMemo(()=>stripGeometry(lines.major,.35,1.1),[lines.major])
  useEffect(()=>()=>{major.dispose();local.dispose();marking.dispose()},[major,local,marking])
  return <>
    <mesh geometry={major} receiveShadow><meshStandardMaterial color="#4c5d61" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={local} receiveShadow><meshStandardMaterial color="#677477" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={marking}><meshBasicMaterial color="#c8c6a1" side={THREE.DoubleSide} /></mesh>
  </>
}

function RailAndIndustry({ illustrated }: { illustrated: boolean }) {
  const boxes = useMemo(() => {
    const result: BoxSpec[] = []
    for (const line of [RAIL_SPINE,BMCT_RAIL]) for (let i=1;i<line.length;i++) {
      const a=line[i-1],b=line[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length
      for (const track of [-6,0,6]) for(const side of [-.72,.72]) {
        const offset=track+side
        result.push(beam([a[0]-dz*offset,1.7,a[1]+dx*offset],[b[0]-dz*offset,1.7,b[1]+dx*offset],.2,'#bec8c6'))
      }
      for (let d=0;d<length;d+=9) result.push({position:[a[0]+dx*d,1.5,a[1]+dz*d],scale:[18,.3,1],rotation:[0,-Math.atan2(dz,dx)+Math.PI/2,0],color:'#6a7775'})
    }
    return result
  },[])
  const ballast = useMemo(()=>stripGeometry([RAIL_SPINE,BMCT_RAIL],23,1.2),[])
  useEffect(()=>()=>ballast.dispose(),[ballast])
  const tanks = useMemo(()=>{
    const points: Point[]=[]
    const xs=TANK_FARM.map(p=>p[0]),zs=TANK_FARM.map(p=>p[1])
    for(let x=Math.min(...xs);x<Math.max(...xs);x+=85)for(let z=Math.min(...zs);z<Math.max(...zs);z+=85)if(inside([x,z],TANK_FARM))points.push([x,z])
    return points
  },[])
  return <>
    <mesh geometry={ballast}><meshStandardMaterial color="#77847e" roughness={1} side={THREE.DoubleSide} /></mesh>
    <InstancedBoxes boxes={boxes} />
    {illustrated && <TankInstances points={tanks} />}
  </>
}

function TankInstances({points}:{points:Point[]}){
  const body=useRef<THREE.InstancedMesh>(null),caps=useRef<THREE.InstancedMesh>(null)
  useEffect(()=>{
    if(!body.current||!caps.current)return
    const dummy=new THREE.Object3D()
    points.forEach(([x,z],i)=>{
      dummy.position.set(x,10,z);dummy.updateMatrix();body.current!.setMatrixAt(i,dummy.matrix)
      dummy.position.y=20.2;dummy.updateMatrix();caps.current!.setMatrixAt(i,dummy.matrix)
    })
    for(const ref of [body,caps]){ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere()}
  },[points])
  return <>
    <instancedMesh ref={body} args={[undefined,undefined,points.length]} castShadow receiveShadow><cylinderGeometry args={[25,25,20,16]}/><meshStandardMaterial color="#c6d0cd" roughness={.7} metalness={.2}/></instancedMesh>
    <instancedMesh ref={caps} args={[undefined,undefined,points.length]}><cylinderGeometry args={[24,25,1,16]}/><meshStandardMaterial color="#e9e7d7" roughness={.8}/></instancedMesh>
  </>
}

export default function PortEnvironment({ illustrated, onRoadError }: { illustrated: boolean; onRoadError: (message: string)=>void }) {
  return <><Water /><CoastalTerrain /><Vegetation /><ReferenceRoads onError={onRoadError} /><RailAndIndustry illustrated={illustrated} /></>
}
