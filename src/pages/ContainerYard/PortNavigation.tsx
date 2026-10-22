import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three-stdlib'
import * as THREE from 'three'
import type { Container } from '@/types/container'
import type { EquipmentRecord } from '@/hooks/useInventory'
import { JNPA_TERMINALS, localToWorld, terminalBounds, type ContainerPlacement } from '@/data/jnpa/portSpatial'

import { buildNavigationClearance } from './navigationClearance'

const MIN_DISTANCE = 8, MAX_DISTANCE = 18000
const MIN_POLAR = .015, MAX_POLAR = Math.PI / 2 - .025
const NO_EQUIPMENT: EquipmentRecord[] = []
type View = 'port' | 'terminal' | 'yard' | 'container'
type Transition = {
  from: THREE.Vector3; to: THREE.Vector3
  start: THREE.Spherical; end: THREE.Spherical; elapsed: number
  startEye: THREE.Vector3; endEye: THREE.Vector3; liftStart: THREE.Vector3; liftEnd: THREE.Vector3
  cruiseStart: THREE.Spherical; cruiseEnd: THREE.Spherical; cruise: boolean
}

// One owner for the camera and one controls.update per frame. Orbit/pan use the
// existing OrbitControls; only wheel radius is smoothed here (its native dolly is
// immediate even with enableDamping). Presets/buttons use the same transition.
export default function PortNavigation({ activeTerminal, request, selected, layout, equipment = NO_EQUIPMENT, illustrated, onViewChange }: {
  activeTerminal: string; request: { preset: string; version: number }
  selected: Container | undefined; layout: ReadonlyMap<string, ContainerPlacement>
  equipment?: EquipmentRecord[]; illustrated: boolean; onViewChange: (view: View) => void
}) {
  const { camera, gl, size, set, get } = useThree()
  const controls = useMemo(() => new OrbitControls(camera as THREE.PerspectiveCamera), [camera])
  const transition = useRef<Transition | null>(null), wheelRadius = useRef<number | null>(null), wheelSign = useRef(0)
  const clearance = useMemo(()=>buildNavigationClearance([...layout.values()],illustrated,equipment),[layout,illustrated,equipment])
  const clearanceRef = useRef(clearance); clearanceRef.current = clearance
  const safe = useRef({position:camera.position.clone(),target:new THREE.Vector3(),ready:false})
  const previousTerminal = useRef(activeTerminal), previousSelected = useRef<string | null>(null)
  const drag=useRef({x:0,y:0,distance:0,down:false})
  const keys = useRef(new Set<string>())
  const scratch = useMemo(() => ({ offset: new THREE.Vector3(), spherical: new THREE.Spherical() }), [])

  const clearMomentum = useCallback(() => {
    const position = camera.position.clone(), target = controls.target.clone()
    controls.enableDamping = false; controls.update() // drain private orbit/pan deltas
    camera.position.copy(position); controls.target.copy(target); controls.update()
    controls.enableDamping = true
  }, [camera, controls])
  const interrupt = useCallback(() => {
    transition.current = null; wheelRadius.current = null; wheelSign.current = 0; controls.enabled = true
  }, [controls])
  const move = useCallback((target: THREE.Vector3, position: THREE.Vector3) => {
    keys.current.clear()
    clearMomentum()
    position=position.clone()
    position.y=Math.max(position.y,clearanceRef.current.floorAt(position.x,position.z))
    for(let y=0;y<=100;y+=10){const top=clearanceRef.current.obstructionTop(position.x,y,position.z);if(Number.isFinite(top))position.y=Math.max(position.y,top+2)}
    const start = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    const end = new THREE.Spherical().setFromVector3(position.clone().sub(target))
    end.radius = THREE.MathUtils.clamp(end.radius, MIN_DISTANCE, MAX_DISTANCE)
    end.phi = THREE.MathUtils.clamp(end.phi, MIN_POLAR, MAX_POLAR)
    // Shortest azimuth path; spherical interpolation avoids a straight chord
    // through terrain when switching between opposite sides of the port.
    end.theta = start.theta + Math.atan2(Math.sin(end.theta - start.theta), Math.cos(end.theta - start.theta))
    const startEye=camera.position.clone(),endEye=target.clone().add(new THREE.Vector3().setFromSpherical(end))
    const liftStart=startEye.clone(),liftEnd=endEye.clone();liftStart.y=Math.max(120,liftStart.y);liftEnd.y=Math.max(120,liftEnd.y)
    const cruiseStart=new THREE.Spherical().setFromVector3(liftStart.clone().sub(controls.target)),cruiseEnd=new THREE.Spherical().setFromVector3(liftEnd.clone().sub(target))
    cruiseEnd.theta=cruiseStart.theta+Math.atan2(Math.sin(cruiseEnd.theta-cruiseStart.theta),Math.cos(cruiseEnd.theta-cruiseStart.theta))
    transition.current = { from: controls.target.clone(), to: target.clone(), start, end, elapsed: 0,
      startEye,endEye,liftStart,liftEnd,cruiseStart,cruiseEnd,cruise:controls.target.distanceTo(target)>100&&Math.min(startEye.y,endEye.y)<120 }
    wheelRadius.current = null; controls.enabled = false
  }, [camera, controls, clearMomentum])

  useEffect(() => {
    controls.minDistance = MIN_DISTANCE; controls.maxDistance = MAX_DISTANCE
    controls.minPolarAngle = MIN_POLAR; controls.maxPolarAngle = MAX_POLAR
    controls.enableDamping = true; controls.enableZoom = true
    controls.screenSpacePanning = true; controls.panSpeed = .65; controls.rotateSpeed = .65
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN
    // Capture enables native controls before their pointer handler sees input.
    const canvas = gl.domElement, document = canvas.ownerDocument, window = document.defaultView!
    const previousTabIndex = canvas.tabIndex
    canvas.tabIndex = 0
    canvas.setAttribute('aria-label', '3D port viewport. Click to focus; WASD or arrows travel, E up, Q down, Shift faster.')
    const navigable = new Set(['KeyW','KeyS','KeyA','KeyD','KeyE','KeyQ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'])
    const resetKeys = () => keys.current.clear()
    const keydown = (event: KeyboardEvent) => {
      if (document.activeElement !== canvas || event.target !== canvas || event.ctrlKey || event.metaKey || event.altKey || !navigable.has(event.code)) return
      event.preventDefault()
      if (!keys.current.size) { interrupt(); clearMomentum() }
      keys.current.add(event.code)
    }
    const keyup = (event: KeyboardEvent) => { keys.current.delete(event.code) }
    const visibility = () => { if (document.hidden) resetKeys() }
    const pointer = (event:PointerEvent) => { canvas.focus({preventScroll:true});interrupt();drag.current={x:event.clientX,y:event.clientY,distance:0,down:true} }
    const track = (event:PointerEvent) => {if(drag.current.down)drag.current.distance=Math.max(drag.current.distance,Math.hypot(event.clientX-drag.current.x,event.clientY-drag.current.y))}
    const release = () => {drag.current.down=false}
    const click = (event:MouseEvent) => {if(drag.current.distance>4){event.preventDefault();event.stopImmediatePropagation()}}
    const stop = () => { clearMomentum(); wheelRadius.current=null; wheelSign.current=0 }
    controls.addEventListener('end',stop)
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      // Own wheel dolly exclusively, retaining native touch/pinch handling.
      event.stopImmediatePropagation()
      if (transition.current) { interrupt(); clearMomentum() }
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? gl.domElement.clientHeight : 1)
      const current=camera.position.distanceTo(controls.target), sign=Math.sign(pixels)
      const radius=sign!==wheelSign.current?current:wheelRadius.current??current
      wheelSign.current=sign
      const scale=Math.exp(THREE.MathUtils.clamp(pixels,-240,240)*(event.ctrlKey ? .008 : .0025))
      wheelRadius.current=THREE.MathUtils.clamp(THREE.MathUtils.clamp(radius*scale,current*.4,current*2.5),MIN_DISTANCE,MAX_DISTANCE)
    }
    const previousControls = get().controls
    set({ controls: controls as unknown as typeof previousControls })
    gl.domElement.addEventListener('pointerdown', pointer, true)
    gl.domElement.ownerDocument.addEventListener('pointermove',track,true)
    gl.domElement.ownerDocument.addEventListener('pointerup',release,true)
    gl.domElement.addEventListener('click',click,true)
    gl.domElement.addEventListener('wheel', wheel, { passive: false, capture: true })
    controls.connect(gl.domElement)
    canvas.addEventListener('keydown', keydown)
    canvas.addEventListener('blur', resetKeys)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', resetKeys)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      resetKeys(); canvas.tabIndex = previousTabIndex; canvas.removeAttribute('aria-label')
      canvas.removeEventListener('keydown', keydown); canvas.removeEventListener('blur', resetKeys)
      window.removeEventListener('keyup', keyup); window.removeEventListener('blur', resetKeys)
      document.removeEventListener('visibilitychange', visibility)
      gl.domElement.removeEventListener('pointerdown', pointer, true)
      gl.domElement.ownerDocument.removeEventListener('pointermove',track,true)
      gl.domElement.ownerDocument.removeEventListener('pointerup',release,true)
      gl.domElement.removeEventListener('click',click,true)
      gl.domElement.removeEventListener('wheel', wheel, true)
      controls.removeEventListener('end',stop); controls.dispose(); set({ controls: previousControls })
    }
  }, [controls, camera, gl, get, set, interrupt, clearMomentum])

  useEffect(() => {
    const changedTerminal = previousTerminal.current !== activeTerminal
    previousTerminal.current = activeTerminal
    const preset = changedTerminal ? (activeTerminal === 'all' ? 'port' : 'terminal') : request.preset
    if (preset.startsWith('zoom-') || preset.startsWith('rotate-')) {
      const offset = camera.position.clone().sub(controls.target)
      if (preset.startsWith('zoom-')) offset.setLength(THREE.MathUtils.clamp(offset.length() * (preset === 'zoom-in' ? .85 : 1 / .85), MIN_DISTANCE, MAX_DISTANCE))
      else offset.applyAxisAngle(camera.up, preset === 'rotate-left' ? Math.PI / 12 : -Math.PI / 12)
      move(controls.target, controls.target.clone().add(offset)); return
    }
    const terminal = preset === 'port' ? undefined : JNPA_TERMINALS.find(t => t.id === activeTerminal)
      ?? (preset === 'yard' ? JNPA_TERMINALS.find(t => t.id === 'BMCT') : undefined)
    const bounds = terminalBounds(terminal), center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2)
    const direction = new THREE.Vector3(-1.25, .85, -.65).normalize()
    if (preset === 'yard' && terminal) {
      const p = localToWorld(terminal, terminal.width / 2, terminal.depth / 2)
      center.set(p[0], 0, p[1]); move(center, center.clone().add(new THREE.Vector3(-180, 250, 310)))
    } else {
      const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize()
      const up = new THREE.Vector3().crossVectors(direction, right).normalize()
      const tangent = Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2))
      let distance = MIN_DISTANCE
      for (const [x, z] of (terminal ? [terminal] : JNPA_TERMINALS).flatMap(t => [...t.footprint, ...t.quay])) for (const y of [0, 105]) {
        const p = new THREE.Vector3(x, y, z).sub(center), depth = p.dot(direction)
        distance = Math.max(distance, Math.abs(p.dot(up)) / tangent + depth, Math.abs(p.dot(right)) / (tangent * size.width / size.height) + depth)
      }
      move(center, center.clone().addScaledVector(direction, distance * 1.12))
    }
    onViewChange(terminal ? (preset === 'yard' ? 'yard' : 'terminal') : 'port')
  }, [activeTerminal, request, camera, controls, size.width, size.height, move, onViewChange])

  useEffect(() => {
    if (!selected) { previousSelected.current = null; return }
    if (previousSelected.current === selected.id) return
    previousSelected.current = selected.id
    const p = layout.get(selected.id)
    if (!p) return
    const [x, z] = localToWorld(p.terminal, p.x, p.z), target = new THREE.Vector3(x, p.y, z)
    move(target, target.clone().add(new THREE.Vector3(-22, 18, 30)))
    onViewChange('container')
  }, [selected, layout, move, onViewChange])

  useFrame((_, delta) => {
    const dt = Math.min(delta, .05), tween = transition.current
    controls.dampingFactor = 1 - Math.exp(-24 * dt)
    if (tween) {
      tween.elapsed = Math.min(1, tween.elapsed + dt / .8)
      const ease=(v:number)=>v*v*(3-2*v),u=tween.elapsed
      if(tween.cruise&&(u<.2||u>.8)){
        if(u<.2){controls.target.copy(tween.from);camera.position.lerpVectors(tween.startEye,tween.liftStart,ease(u/.2))}
        else{controls.target.copy(tween.to);camera.position.lerpVectors(tween.liftEnd,tween.endEye,ease((u-.8)/.2))}
      }else{
        const t=ease(tween.cruise?(u-.2)/.6:u),start=tween.cruise?tween.cruiseStart:tween.start,end=tween.cruise?tween.cruiseEnd:tween.end
        controls.target.lerpVectors(tween.from,tween.to,t)
        scratch.spherical.set(Math.exp(THREE.MathUtils.lerp(Math.log(start.radius),Math.log(end.radius),t)),
          THREE.MathUtils.lerp(start.phi,end.phi,t),THREE.MathUtils.lerp(start.theta,end.theta,t))
        camera.position.copy(controls.target).add(scratch.offset.setFromSpherical(scratch.spherical))
        if(tween.cruise)camera.position.y=Math.max(120,camera.position.y)
      }
      if (tween.elapsed === 1) { transition.current = null; controls.enabled = true }
    } else if (wheelRadius.current !== null) {
      scratch.offset.copy(camera.position).sub(controls.target)
      const radius = THREE.MathUtils.lerp(scratch.offset.length(), wheelRadius.current, 1 - Math.exp(-22 * dt))
      camera.position.copy(controls.target).add(scratch.offset.setLength(radius))
      if (Math.abs(radius - wheelRadius.current) < .02) wheelRadius.current = null
    }
    controls.update()
    const bounds=clearanceRef.current
    // Flight translates eye AND target, preserving the viewing direction even
    // from overhead. A target may be below ground; only the eye needs clearance.
    const held = keys.current, has = (...codes: string[]) => codes.some(code => held.has(code))
    let flying = false
    if (held.size) {
      const forward = camera.getWorldDirection(new THREE.Vector3())
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
      const direction = forward.multiplyScalar(Number(has('KeyW','ArrowUp')) - Number(has('KeyS','ArrowDown')))
        .addScaledVector(right, Number(has('KeyD','ArrowRight')) - Number(has('KeyA','ArrowLeft')))
      direction.y += Number(has('KeyE')) - Number(has('KeyQ'))
      if (direction.lengthSq() > 0) {
        flying = true
        const altitude = camera.position.y - bounds.floorAt(camera.position.x,camera.position.z)
        const speed = THREE.MathUtils.clamp(altitude * .8, 3, 1200) * (has('ShiftLeft','ShiftRight') ? 3 : 1)
        const step = direction.normalize().multiplyScalar(speed * dt), steps = Math.max(1,Math.ceil(step.length()/2))
        step.divideScalar(steps)
        const clear = (p: THREE.Vector3) => p.y >= bounds.floorAt(p.x,p.z) && !Number.isFinite(bounds.obstructionTop(p.x,p.y,p.z))
        for (let i=0;i<steps;i++) {
          const before = camera.position.clone(), next = before.clone().add(step)
          if (clear(next)) camera.position.copy(next)
          else for (const axis of ['y','x','z'] as const) {
            const slide = camera.position.clone(); slide[axis] += step[axis]
            if (clear(slide)) camera.position.copy(slide)
          }
          controls.target.add(camera.position.clone().sub(before))
        }
      }
    }
    let floor=bounds.floorAt(camera.position.x,camera.position.z)
    scratch.spherical.setFromVector3(scratch.offset.copy(camera.position).sub(controls.target))
    scratch.spherical.radius=THREE.MathUtils.clamp(scratch.spherical.radius,Math.max(MIN_DISTANCE,floor-controls.target.y+1),MAX_DISTANCE)
    controls.maxPolarAngle=Math.max(MIN_POLAR,Math.min(MAX_POLAR,Math.acos(THREE.MathUtils.clamp((floor-controls.target.y)/scratch.spherical.radius,-1,1))))
    scratch.spherical.phi=THREE.MathUtils.clamp(scratch.spherical.phi,MIN_POLAR,controls.maxPolarAngle)
    camera.position.copy(controls.target).add(scratch.offset.setFromSpherical(scratch.spherical))
    // Check swept movement only near structures. A small local bucket query
    // avoids scanning thousands of instanced meshes or tunnelling through them.
    let blocked=false
    if(!flying && safe.current.ready && Math.min(safe.current.position.y,camera.position.y)<100){
      const distance=safe.current.position.distanceTo(camera.position),steps=Math.min(200,Math.max(1,Math.ceil(distance/2)))
      for(let i=1;i<=steps;i++){
        const f=i/steps,x=THREE.MathUtils.lerp(safe.current.position.x,camera.position.x,f),
          y=THREE.MathUtils.lerp(safe.current.position.y,camera.position.y,f),z=THREE.MathUtils.lerp(safe.current.position.z,camera.position.z,f)
        if(y<bounds.floorAt(x,z)-.01 || Number.isFinite(bounds.obstructionTop(x,y,z))){blocked=true;break}
      }
    }
    if(blocked && !Number.isFinite(bounds.obstructionTop(safe.current.position.x,safe.current.position.y,safe.current.position.z))){
      camera.position.copy(safe.current.position);controls.target.copy(safe.current.target)
      interrupt();clearMomentum()
    }
    camera.lookAt(controls.target)
    safe.current.position.copy(camera.position);safe.current.target.copy(controls.target);safe.current.ready=true
    floor=bounds.floorAt(camera.position.x,camera.position.z)
    const radius=camera.position.distanceTo(controls.target)
    controls.panSpeed=THREE.MathUtils.clamp((camera.position.y-floor+15)/radius,.03,.8)
    // Close rows need a short near plane; overview needs depth precision. Height
    // also caps clipping distance so a low oblique view never clips nearby boxes.
    const near=Math.max(.08,Math.min(80,radius*.01,Math.max(.08,(camera.position.y-floor+2)*.15)))
    const perspective=camera as THREE.PerspectiveCamera
    if(Math.abs(perspective.near-near)>Math.max(.005,perspective.near*.02)){perspective.near=near;perspective.updateProjectionMatrix()}
  }, -1)
  return null
}
