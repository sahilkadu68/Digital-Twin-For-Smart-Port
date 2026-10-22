import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { Container, ContainerStatus } from '@/types/container'
import { useAppStore } from '@/store/appStore'
import { useContainers } from '@/hooks/useContainers'
import { useInventory, occupiesYard } from '@/hooks/useInventory'
import { inventoryQuality, validPosition } from '@/utils/inventoryQuality'
import { equipmentPlacements } from '@/data/jnpa/equipmentPlacement'
import { JNPA_TERMINALS, buildContainerLayout, filteredStackSupports, localToWorld, terminalBounds, type ContainerPlacement, type JNPATerminal } from '@/data/jnpa/portSpatial'
import Terminal3D from './components/Terminal3D'
import PortEnvironment from './components/PortEnvironment'
import { IllustrativeShip, StoredRTGs } from './components/PortAssets'
import PortNavigation from './PortNavigation'

const STATUS_COLORS: Record<ContainerStatus,string> = {
  import:'#2563eb',export:'#22a576',transshipment:'#9865c4','gate-in':'#2aa5b8','gate-out':'#668b83',
  'customs-hold':'#c4514c',inspection:'#de934c',empty:'#b7c3c0',loaded:'#5e78bb',
}
const SHIPPING_COLORS=['#a85843','#54868d','#c0a864','#3b7586','#567f68','#a7b5ac','#b17b53','#677ca5']
const containerGeometry=new THREE.BoxGeometry(1,1,1)
function containerMaterial(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64
  const c=canvas.getContext('2d')!
  c.fillStyle='#e0e3de';c.fillRect(0,0,256,64)
  for(let x=4;x<256;x+=9){c.fillStyle='#c2c8c5';c.fillRect(x,3,2,58);c.fillStyle='#f2f2e9';c.fillRect(x+2,3,1,58)}
  c.strokeStyle='#8b9998';c.lineWidth=2;c.strokeRect(1,1,254,62)
  c.fillStyle='#ecede2';c.fillRect(16,12,38,10)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4
  return new THREE.MeshStandardMaterial({map:texture,roughness:.7,metalness:.2})
}
function paint(c: Container,statusColors: boolean){
  if(statusColors)return STATUS_COLORS[c.status]??'#9aa8a8'
  let hash=0;for(const ch of c.shippingLine??'')hash=(hash*31+ch.charCodeAt(0))|0
  return SHIPPING_COLORS[(hash>>>0)%SHIPPING_COLORS.length]
}
function ContainerBatch({terminal,containers,layout,selectedId,onSelect,statusColors,support=false}:{
  terminal:JNPATerminal;containers:Container[];layout:ReadonlyMap<string,ContainerPlacement>;selectedId:string|null;onSelect:(id:string)=>void;statusColors:boolean;support?:boolean
}){
  const ref=useRef<THREE.InstancedMesh>(null)
  const material=useMemo(()=>{const m=containerMaterial();if(support)m.roughness=.95;return m},[support])
  useEffect(()=>()=>{material.map?.dispose();material.dispose()},[material])
  useLayoutEffect(()=>{
    if(!ref.current)return
    const dummy=new THREE.Object3D(),color=new THREE.Color()
    containers.forEach((c,i)=>{
      const p=layout.get(c.id)!
      dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.length,p.height,p.width);dummy.updateMatrix()
      ref.current!.setMatrixAt(i,dummy.matrix)
      ref.current!.setColorAt(i,color.set(support?'#a4b4b3':c.id===selectedId?'#ffe09b':paint(c,statusColors)))
    })
    ref.current.instanceMatrix.needsUpdate=true
    if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true
    ref.current.computeBoundingSphere()
  },[containers,layout,selectedId,statusColors,support])
  return containers.length?<group position={[terminal.x,0,terminal.z]} rotation={[0,terminal.rotation,0]}>
    <instancedMesh name={(support?'support-context-':'containers-')+terminal.id} key={containers.length} ref={ref} args={[containerGeometry,material,containers.length]} dispose={null} castShadow receiveShadow
      onClick={support?undefined:e=>{if(e.delta>4)return;e.stopPropagation();if(e.instanceId!==undefined)onSelect(containers[e.instanceId].id)}} />
  </group>:null
}
function TerminalScene({containers,supports,layout,labelTerminal,selectedId,onSelect,activeTerminal,statusColors,illustrated,onFocus}:{
  containers:Container[];supports:Container[];layout:ReadonlyMap<string,ContainerPlacement>;labelTerminal:string|null;selectedId:string|null;onSelect:(id:string)=>void;activeTerminal:string;statusColors:boolean;illustrated:boolean;onFocus:(id:string)=>void
}){
  const {equipment,terminals}=useInventory()
  const grouped=useMemo(()=>{
    const map=new Map<string,Container[]>()
    for(const c of containers){const list=map.get(c.terminal)??[];list.push(c);map.set(c.terminal,list)}
    return map
  },[containers])
  const supportGroups=useMemo(()=>{
    const map=new Map<string,Container[]>()
    for(const c of supports){const list=map.get(c.terminal)??[];list.push(c);map.set(c.terminal,list)}
    return map
  },[supports])
  return <>
    {JNPA_TERMINALS.map(t=>{
      const locations=equipmentPlacements(t,equipment),label=localToWorld(t,t.width/2,-35)
      const name=terminals.find(r=>r.code===t.id)?.name??t.name
      return <group key={t.id}>
        <Terminal3D terminal={t} active={activeTerminal==='all'||activeTerminal===t.id} illustrated={illustrated} onFocus={()=>onFocus(t.id)} />
        <ContainerBatch terminal={t} containers={grouped.get(t.id)??[]} layout={layout} selectedId={selectedId} onSelect={onSelect} statusColors={statusColors}/>
        <ContainerBatch terminal={t} containers={supportGroups.get(t.id)??[]} layout={layout} selectedId={null} onSelect={onSelect} statusColors={false} support/>
        <StoredRTGs terminal={t} locations={locations}/>
        {(!labelTerminal||labelTerminal===t.id)&&<Html position={[label[0],45,label[1]]} center style={{pointerEvents:'none'}}>
          <button title={name+' · approximate yard placement'} onClick={()=>onFocus(t.id)} style={{pointerEvents:'auto',borderColor:t.accent}}
            className="rounded border-l-4 bg-slate-950/80 px-2 py-1 text-[10px] font-semibold tracking-wider text-white shadow">
            {t.id}<span className="ml-1 text-[8px] text-slate-300">↗</span>
          </button>
        </Html>}
      </group>
    })}
    {illustrated&&<>
      <IllustrativeShip terminal={JNPA_TERMINALS.find(t=>t.id==='BMCT')!} offset={480} length={330} width={48}/>
      <IllustrativeShip terminal={JNPA_TERMINALS.find(t=>t.id==='BMCT')!} offset={1400} length={300}/>
      <IllustrativeShip terminal={JNPA_TERMINALS.find(t=>t.id==='APMT')!} offset={350} length={270} width={39}/>
    </>}
  </>
}
export default function DigitalTwinViewport(){
  const selectedId=useAppStore(s=>s.selectedContainerId),setSelected=useAppStore(s=>s.setSelectedContainer)
  const activeTerminal=useAppStore(s=>s.activeTerminal),setActiveTerminal=useAppStore(s=>s.setActiveTerminal)
  const {containers:filtered,loading,error}=useContainers(true),{containers:allContainers,equipment}=useInventory()
  const layout=useMemo(()=>buildContainerLayout(allContainers),[allContainers])
  const containers=useMemo(()=>filtered.filter(c=>layout.has(c.id)),[filtered,layout])
  const selected=useMemo(()=>allContainers.find(c=>c.id===selectedId&&layout.has(c.id)),[allContainers,selectedId,layout])
  const supports=useMemo(()=>filteredStackSupports(containers,layout),[containers,layout])
  const selectedPlacement=selected?layout.get(selected.id):undefined
  const quality=useMemo(()=>inventoryQuality(allContainers),[allContainers])
  const [illustrated,setIllustrated]=useState(true),[statusColors,setStatusColors]=useState(false)
  const [roadError,setRoadError]=useState<string|null>(null),[retrievalMessage,setRetrievalMessage]=useState<string|null>(null)
  const [request,setRequest]=useState({preset:'port',version:0}),[view,setView]=useState('port')
  const onViewChange=useCallback((mode:string)=>setView(mode),[])
  const onRoadError=useCallback((message:string)=>setRoadError(message),[])
  const focus=useCallback((id:string)=>{setActiveTerminal(id);setRequest(r=>({preset:'terminal',version:r.version+1}))},[setActiveTerminal])
  const fit=(preset:string)=>setRequest(r=>({preset,version:r.version+1}))
  useEffect(()=>{
    const retrieve=(event:Event)=>{
      const id=(event as CustomEvent<string>).detail,target=allContainers.find(c=>c.id===id)
      if(!target){setRetrievalMessage('Container not found.');return}
      const same=(c:Container)=>c.terminal===target.terminal&&c.yard===target.yard&&c.block===target.block&&c.row===target.row&&c.column===target.column
      if(!validPosition(target)||!layout.has(id)){
        setRetrievalMessage('Stored position needs review. Accessibility cannot be established.');return
      }
      const count=allContainers.filter(c=>occupiesYard(c)&&same(c)&&c.level>target.level).length
      setRetrievalMessage(count?count+' stored container(s) above this record.':'No stored containers above this record. No movement performed.')
    }
    window.addEventListener('start-container-move',retrieve);return()=>window.removeEventListener('start-container-move',retrieve)
  },[allContainers,layout])
  const sunLight=useRef<THREE.DirectionalLight>(null)
  const lightBounds=useMemo(()=>terminalBounds(JNPA_TERMINALS.find(t=>t.id===activeTerminal)),[activeTerminal])
  const sunTarget=useMemo(()=>{
    const target=new THREE.Object3D(),p=selected?layout.get(selected.id):null
    if(p){const [x,z]=localToWorld(p.terminal,p.x,p.z);target.position.set(x,0,z)}
    else target.position.set((lightBounds.minX+lightBounds.maxX)/2,0,(lightBounds.minZ+lightBounds.maxZ)/2)
    return target
  },[lightBounds,selected,layout])
  const shadowSpan=selected?250:Math.max(lightBounds.maxX-lightBounds.minX,lightBounds.maxZ-lightBounds.minZ)*.7+150
  useLayoutEffect(()=>{sunLight.current?.shadow.camera.updateProjectionMatrix()},[shadowSpan])
  return <div className="relative h-full w-full overflow-hidden rounded-lg border border-slate-300 bg-[#bdd0d5]">
    <Canvas shadows dpr={[1,1.5]} gl={{antialias:true,alpha:false}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.1}}>
      <color attach="background" args={['#bdd0d5']}/><fog attach="fog" args={['#bdd0d5',10000,26000]}/>
      <PerspectiveCamera makeDefault position={[-4200,4800,4200]} fov={42} near={20} far={40000}/>
      <hemisphereLight args={['#e1f1ed','#6f8779',.85]}/><ambientLight intensity={.25}/>
      <primitive object={sunTarget}/>
      <directionalLight ref={sunLight} position={[sunTarget.position.x-3500,6500,sunTarget.position.z-2000]} target={sunTarget} intensity={2.2} color="#fff1d9" castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-left={-shadowSpan} shadow-camera-right={shadowSpan} shadow-camera-top={shadowSpan} shadow-camera-bottom={-shadowSpan}
        shadow-camera-near={100} shadow-camera-far={16000} shadow-normalBias={.35} shadow-bias={-.00005}/>
      <directionalLight position={[2500,2000,-4000]} intensity={.4} color="#a4d9e7"/>
      <PortEnvironment illustrated={illustrated} onRoadError={onRoadError}/>
      <TerminalScene containers={containers} supports={supports} layout={layout} labelTerminal={view==='port'?null:activeTerminal==='all'?'BMCT':activeTerminal} selectedId={selectedId} onSelect={setSelected} activeTerminal={activeTerminal}
        illustrated={illustrated} statusColors={statusColors} onFocus={focus}/>
      <PortNavigation activeTerminal={activeTerminal} request={request} selected={selected} layout={layout} equipment={equipment} illustrated={illustrated} onViewChange={onViewChange}/>
    </Canvas>
    <div className="pointer-events-none absolute left-2 top-2 max-w-[48%] rounded-md border border-slate-300/60 bg-white/85 px-2 py-1 text-[11px] text-slate-700 shadow-sm backdrop-blur-sm">
      <p className="font-semibold">JNPA / {view==='port'?'Full Port':activeTerminal==='all'?'BMCT':activeTerminal}</p>
      {selectedPlacement&&<p className="text-[10px] text-slate-500">Level {selectedPlacement.displayTier}</p>}
    </div>
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-end justify-between gap-2 text-[11px] text-slate-700">
    <details className="pointer-events-auto max-w-[min(300px,100%)] rounded-md border border-slate-300/60 bg-white/85 px-2 py-1 shadow-sm backdrop-blur-sm">
      <summary className="cursor-pointer font-medium">{containers.length.toLocaleString('en-IN')} yard records</summary>
      <div className="mt-1 max-h-32 space-y-1 overflow-auto text-[10px] text-slate-600">
        <p>Approximate model; yard slots and infrastructure positions are illustrative, not surveyed or live telemetry.</p>
        <p>{quality.collidingSlots} slot conflicts · {quality.duplicateNumbers} duplicate-number groups · {quality.unresolvedAssignments} unresolved assignments.</p>
        <p>Shared inventory · four-high prototype rule. Original assignments are retained in migration history.</p>
        {supports.length>0&&<p>{supports.length.toLocaleString()} muted support containers are excluded from this filtered count.</p>}
        <p>{equipment.filter(e=>e.type==='rtg'&&(activeTerminal==='all'||e.terminal===activeTerminal)).length} stored RTGs in scope; block travel positions are illustrative. NSDT has no stored RTGs.</p>
        {statusColors&&<div className="flex flex-wrap gap-2">{Object.entries(STATUS_COLORS).map(([name,color])=><span key={name}><i className="mr-1 inline-block h-2 w-2" style={{background:color}}/>{name}</span>)}</div>}
      </div>
    </details>
    <div className="pointer-events-auto ml-auto flex w-60 max-w-full flex-col gap-1 rounded-md border border-slate-300/60 bg-white/85 p-1.5 shadow-sm backdrop-blur-sm">
      <div className="flex gap-1">
        <button onClick={()=>fit('port')} className="rounded bg-slate-800 px-2 py-1 text-white">Full port</button>
        <button onClick={()=>fit('terminal')} className="rounded bg-slate-100 px-2 py-1">Fit terminal</button>
        <button onClick={()=>fit('yard')} className="rounded bg-slate-100 px-2 py-1">Yard detail</button>
      </div>
      <div className="flex items-center justify-between">
        <button title="Zoom out" onClick={()=>fit('zoom-out')} className="px-2 py-1">−</button>
        <button title="Rotate left" onClick={()=>fit('rotate-left')} className="px-2 py-1">↶</button>
        <button title="Rotate right" onClick={()=>fit('rotate-right')} className="px-2 py-1">↷</button>
        <button title="Zoom in" onClick={()=>fit('zoom-in')} className="px-2 py-1">+</button>
      </div>
      <p className="text-[10px] leading-snug text-slate-500" title="Click the scene to focus. Arrow keys also move; E/Q raise/lower, Shift boosts speed, Tab leaves flight.">Drag: orbit · Right-drag: pan · Wheel: zoom · WASD: move</p>
      <label className="flex justify-between gap-2">Illustrative infrastructure<input type="checkbox" checked={illustrated} onChange={e=>setIllustrated(e.target.checked)}/></label>
      <label className="flex justify-between gap-2">Container status colors<input type="checkbox" checked={statusColors} onChange={e=>setStatusColors(e.target.checked)}/></label>
    </div>
    </div>
    {(loading||error||roadError)&&<p role="status" className="absolute left-3 top-20 rounded bg-white/95 p-2 text-xs">{loading?'Loading inventory…':error||roadError}</p>}
    {retrievalMessage&&<button onClick={()=>setRetrievalMessage(null)} className="absolute bottom-20 left-1/2 max-w-md -translate-x-1/2 rounded bg-slate-900 px-3 py-2 text-xs text-white">{retrievalMessage} ×</button>}
  </div>
}
