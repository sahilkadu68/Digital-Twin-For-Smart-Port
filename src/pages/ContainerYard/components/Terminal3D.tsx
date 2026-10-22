import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { YARD_GRIDS } from '@/data/yardGeometry'
import { BANK_TOP_Y, TERMINAL_SURFACE_Y, blockLayout, terminalBuildingLayout, type JNPATerminal } from '@/data/jnpa/portSpatial'
import { InstancedBoxes, QuayCranes } from './PortAssets'
import { surfaceGeometry, stripGeometry, quayFrame, type BoxSpec } from '../portMeshes'

export default function Terminal3D({ terminal: t, active, illustrated, onFocus }: {
  terminal: JNPATerminal; active: boolean; illustrated: boolean; onFocus: () => void
}) {
  const surface=useMemo(()=>surfaceGeometry(t.footprint),[t])
  const border=useMemo(()=>stripGeometry([[...t.footprint,t.footprint[0]]],1.2,.9),[t])
  useEffect(()=>()=>{surface.dispose();border.dispose()},[surface,border])
  const boxes=useMemo(()=>{
    const items: BoxSpec[]=[]
    for(let i=0;i<YARD_GRIDS[t.id].blocks;i++){
      const b=blockLayout(t,i),x=b.x+b.width/2,z=b.z+b.depth/2
      items.push({position:[x,(BANK_TOP_Y+TERMINAL_SURFACE_Y)/2,z],scale:[b.width+3,BANK_TOP_Y-TERMINAL_SURFACE_Y,b.depth+2],color:'#a2adac'})
      for(const side of [-1,1])items.push({position:[x,TERMINAL_SURFACE_Y+.065,z+side*(b.depth/2+2)],scale:[b.width+4,.01,.18],color:'#e0cb7a'})
      items.push({position:[x,TERMINAL_SURFACE_Y+.025,b.z+b.depth+9],scale:[b.width+17,.05,12],color:'#3d5059'})
      for(let d=0;d<b.width;d+=18)items.push({position:[b.x+d+4,TERMINAL_SURFACE_Y+.06,b.z+b.depth+9],scale:[7,.012,.25],color:'#dfdfc2'})
      if(i%3===0){
        items.push({position:[b.x-7,TERMINAL_SURFACE_Y+12.5,b.z],scale:[.7,25,.7],color:'#aebec1'})
        items.push({position:[b.x-7,TERMINAL_SURFACE_Y+25,b.z],scale:[7,.5,2],color:'#e0e3ce'})
      }
    }
    return items
  },[t])
  const buildings=useMemo(()=>{
    const {width:w,depth,x,z}=terminalBuildingLayout(t)
    return [
      {position:[x,9,z],scale:[w,16,depth],color:'#c4cec8'},
      {position:[x,17.5,z],scale:[w+5,1.8,depth+4],color:t.id==='BMCT'?'#527e88':'#719197'},
      {position:[x,18.5,z],scale:[w*.83,.4,depth*.67],color:'#345d73'},
      {position:[x+w*.6,5,z],scale:[25,8,Math.min(22,depth*.8)],color:'#d9ddcf'},
    ].map(b=>({...b,position:[b.position[0],b.position[1]-(1-TERMINAL_SURFACE_Y),b.position[2]]})) as BoxSpec[]
  },[t])
  const quay=quayFrame(t)
  const quayBoxes=useMemo(()=>{
    const items: BoxSpec[]=[
      {position:[t.quayLength/2,-.1,13],scale:[t.quayLength,2.4,38],color:'#c4c8be'},
      {position:[t.quayLength/2,1.15,28],scale:[t.quayLength,.12,.5],color:'#e4cd78'},
    ]
    for(let x=15;x<t.quayLength;x+=30){
      items.push({position:[x,-.5,-7],scale:[3,4,3],color:'#263d48'})
      items.push({position:[x,1.7,1],scale:[1.8,1.2,1.8],color:'#d5ab5e'})
    }
    return items
  },[t])
  return <>
    <mesh geometry={surface} position={[0,TERMINAL_SURFACE_Y,0]} receiveShadow onDoubleClick={e=>{e.stopPropagation();onFocus()}}>
      <meshStandardMaterial color={active?'#667b80':'#6d8080'} roughness={.94} side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={border}><meshBasicMaterial color={active?t.accent:'#7b9392'} side={THREE.DoubleSide} /></mesh>
    <group position={[t.x,0,t.z]} rotation={[0,t.rotation,0]}>
      <InstancedBoxes boxes={boxes} />{illustrated && <InstancedBoxes boxes={buildings} />}
    </group>
    <group position={quay.position} rotation={[0,quay.rotation,0]}><InstancedBoxes boxes={quayBoxes} /></group>
    {illustrated && <QuayCranes terminal={t} />}
  </>
}
