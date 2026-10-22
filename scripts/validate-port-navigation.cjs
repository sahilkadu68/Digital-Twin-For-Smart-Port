// Executes the actual navigation component with real three-stdlib MapControls,
// a small React hook harness and an in-memory DOM. No server or data writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three');
const modules={};let cursor=0,slots=[],pending=[],frame;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const hooks={
 useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value});},
 useMemo(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
 useCallback(fn,deps){return hooks.useMemo(()=>fn,deps);},
 useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))pending.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
};
class Surface{
 constructor(){this.listeners=new Map();this.style={};this.clientHeight=900;this.clientWidth=1400;}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
 emit(name,event={}){let stopped=false,prevented=false;for(const fn of [...this.listeners.get(name)||[]]){fn({preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;},pointerType:'mouse',pointerId:1,clientX:700,clientY:450,...event});if(stopped)break;}return prevented;}
 releasePointerCapture(){}
 setAttribute(){}
 removeAttribute(){}
 focus(){this.ownerDocument.activeElement=this;}
 count(){return [...this.listeners.values()].reduce((n,v)=>n+v.size,0);}
}
const dom=new Surface();dom.ownerDocument=new Surface();
dom.tabIndex=-1;dom.ownerDocument.defaultView=new Surface();
const camera=new THREE.PerspectiveCamera(42,1400/900,20,40000);camera.position.set(-4200,4800,4200);
const state={camera,gl:{domElement:dom},size:{width:1400,height:900},controls:undefined};
state.get=()=>state;state.set=value=>Object.assign(state,value);
function load(path){if(modules[path])return modules[path];const module={exports:{}};
 const requireLocal=name=>name==='react'?hooks:name==='@react-three/fiber'?{useThree:()=>state,useFrame:fn=>{frame=fn;}}:
 name.includes('navigationClearance')?load('src/pages/ContainerYard/navigationClearance.ts'):name.includes('portSpatial')?load('src/data/jnpa/portSpatial.ts'):name.includes('yardAssignments')?load('src/data/yardAssignments.ts'):name.includes('equipmentPlacement')?load('src/data/jnpa/equipmentPlacement.ts'):name.includes('yardGeometry')?load('src/data/yardGeometry.ts'):require(name);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:requireLocal});
 return modules[path]=module.exports;
}
const Navigation=load('src/pages/ContainerYard/PortNavigation.tsx').default;
const spatial=load('src/data/jnpa/portSpatial.ts'),grids=load('src/data/yardGeometry.ts').YARD_GRIDS;
const fixture=spatial.JNPA_TERMINALS.map(t=>({id:t.id,terminal:t.id,yard:grids[t.id].prefix+'-YARD',block:grids[t.id].prefix+'-01',row:1,column:1,level:1,type:'40ft'}));
const selectedRecord=Object.freeze({id:'selection-check',terminal:'BMCT',yard:'BM-YARD',block:'BM-33',row:5,column:9,level:2,type:'40ft'});
fixture.push({...selectedRecord,id:'selection-support',level:1},selectedRecord);
const layout=spatial.buildContainerLayout(fixture);
let view,version=0;const props={activeTerminal:'all',request:{preset:'port',version},selected:undefined,layout,visible:fixture,supports:[],illustrated:true,onViewChange:v=>{view=v;}};
function render(){cursor=0;pending=[];Navigation(props);for(const fn of pending)fn();}
function frames(n=180,dt=1/60){for(let i=0;i<n;i++){frame(state,dt);camera.updateMatrixWorld();assert.ok(camera.position.y>=2-1e-6);const r=camera.position.distanceTo(state.controls.target);assert.ok(r>=8-1e-6&&r<=18000+1e-6);}}
function action(preset){props.request={preset,version:++version};const before=camera.position.clone();render();assert.ok(before.distanceTo(camera.position)<1e-6,'action must not snap');frames();}
render();frames();assert.equal(view,'port');const port=camera.position.clone();
for(const terminal of load('src/data/jnpa/portSpatial.ts').JNPA_TERMINALS)for(const [x,z]of [...terminal.footprint,...terminal.quay])for(const y of [0,105]){
 const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1,terminal.id+' must fit overview');
}
props.activeTerminal='BMCT';render();frames();assert.equal(view,'terminal');const bmct=camera.position.clone();
action('yard');assert.equal(view,'yard');assert.ok(camera.position.distanceTo(bmct)>100);
action('port');assert.ok(camera.position.distanceTo(port)<1e-5);assert.equal(props.activeTerminal,'BMCT','overview must retain terminal filter');
action('terminal');action('yard');
for(let i=0;i<8;i++){action(i%2?'rotate-right':'rotate-left');action(i%2?'zoom-out':'zoom-in');}
// Wheel has no synchronous distance jump, clamps both limits and settles.
let before=camera.position.clone();dom.emit('wheel',{deltaY:-120,deltaMode:0});assert.equal(before.distanceTo(camera.position),0);frames();
for(let i=0;i<100;i++){dom.emit('wheel',{deltaY:-120,deltaMode:0});frames(5);}frames();assert.ok(Math.abs(camera.position.distanceTo(state.controls.target)-8)<.03);
for(let i=0;i<100;i++){dom.emit('wheel',{deltaY:120,deltaMode:0});frames(5);}frames();assert.ok(Math.abs(camera.position.distanceTo(state.controls.target)-18000)<.03);
action('yard');
// Native right pan translates camera and target together; no residual drift.
before=camera.position.clone();const target=state.controls.target.clone();
dom.emit('pointerdown',{button:2});dom.ownerDocument.emit('pointermove',{button:2,clientX:780,clientY:480});dom.ownerDocument.emit('pointerup',{button:2});frames();
const pan=camera.position.clone().sub(before),targetPan=state.controls.target.clone().sub(target);assert.ok(pan.length()>1);assert.ok(pan.distanceTo(targetPan)<1e-5);
assert.ok(Math.abs(targetPan.y)>1,'right pan must include vertical movement');
before=camera.position.clone();frames();assert.ok(camera.position.distanceTo(before)<1e-5,'pan must settle');
dom.emit('pointerdown',{button:0});dom.ownerDocument.emit('pointermove',{button:0,clientX:900,clientY:580});dom.ownerDocument.emit('pointerup',{button:0});frames();
assert.ok(camera.position.distanceTo(before)>1,'left drag orbits');before=camera.position.clone();frames();assert.ok(camera.position.distanceTo(before)<1e-5,'orbit must settle');
assert.ok(dom.emit('click'),'a completed drag must suppress selection click');
dom.emit('pointerdown',{button:1});dom.ownerDocument.emit('pointermove',{button:1,clientX:730,clientY:470});dom.ownerDocument.emit('pointerup',{button:1});
before=camera.position.clone();frames();assert.ok(camera.position.distanceTo(before)<1e-5,'middle pan stops immediately on release');
dom.emit('pointerdown',{button:0});dom.ownerDocument.emit('pointerup',{button:0});assert.equal(dom.emit('click'),false,'ordinary clicks remain available');
// Mouse interrupts an in-progress preset without resetting its current pose.
props.request={preset:'port',version:++version};render();frames(8);before=camera.position.clone();
dom.emit('pointerdown',{button:0});dom.ownerDocument.emit('pointerup',{button:0});assert.ok(before.distanceTo(camera.position)<1e-6);frames();assert.ok(before.distanceTo(camera.position)<1e-5);
props.activeTerminal='NSICT';render();frames();assert.equal(view,'terminal');action('yard');action('port');
props.selected=selectedRecord;
render();frames();assert.equal(view,'container');action('port');assert.equal(props.selected.id,'selection-check');assert.equal(view,'port');
assert.ok(camera.position.distanceTo(port)<1e-4,'close selection must return to the actual overview');
// Fine trackpad-like deltas and quick reversals must remain controllable.
action('yard');let radius=camera.position.distanceTo(state.controls.target);
assert.ok(dom.emit('wheel',{deltaY:-2,deltaMode:0}));frames(3);assert.ok(camera.position.distanceTo(state.controls.target)<radius);
dom.emit('wheel',{deltaY:-120,deltaMode:0});frames(1);radius=camera.position.distanceTo(state.controls.target);
dom.emit('wheel',{deltaY:120,deltaMode:0});frames(1);assert.ok(camera.position.distanceTo(state.controls.target)>radius,'wheel reversal responds immediately');frames();
assert.ok(dom.emit('contextmenu'),'canvas context menu is suppressed');assert.equal(new Surface().emit('wheel',{deltaY:50}),false,'outside viewport remains unhandled');
// A close, low-oblique manual pose must not retain the old 110m/280m limits.
camera.position.copy(state.controls.target).add(new THREE.Vector3(-20,5,20));state.controls.update();frames();assert.ok(camera.position.y<20);assert.ok(camera.position.distanceTo(state.controls.target)<40);
action('port');assert.ok(camera.position.distanceTo(port)<1e-4,'low view returns through safe cruise');
const listeners=dom.count();for(let i=0;i<10;i++)render();assert.equal(dom.count(),listeners,'rerenders must not add listeners');
// Hold/release the actual component's keyboard listeners through real animation
// frames. No immediate keydown displacement; diagonals use one normalized speed.
function pose(overhead=false){
 state.controls.maxPolarAngle=Math.PI/2-.025;camera.position.set(9000,500,9000);state.controls.target.set(9000,overhead?0:495,overhead?8999:8950);state.controls.update();frames(1);dom.focus();
}
const down=code=>dom.emit('keydown',{code,target:dom});
const up=code=>dom.ownerDocument.defaultView.emit('keyup',{code});
for(const code of ['KeyW','KeyS','KeyA','KeyD','KeyE','KeyQ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
 pose();before=camera.position.clone();const forward=camera.getWorldDirection(new THREE.Vector3()),right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();
 assert.ok(down(code));assert.ok(camera.position.distanceTo(before)<1e-6);frames(30);up(code);
 const delta=camera.position.clone().sub(before);assert.ok(delta.length()>10,code+' continuous held movement');
 if(['KeyW','ArrowUp'].includes(code))assert.ok(delta.clone().normalize().dot(forward)>.999);
 if(['KeyS','ArrowDown'].includes(code))assert.ok(delta.clone().normalize().dot(forward)<-.999);
 if(['KeyA','ArrowLeft'].includes(code))assert.ok(delta.dot(right)<0&&Math.abs(delta.y)<1e-6);
 if(['KeyD','ArrowRight'].includes(code))assert.ok(delta.dot(right)>0&&Math.abs(delta.y)<1e-6);
 if(code==='KeyE')assert.ok(delta.y>0);if(code==='KeyQ')assert.ok(delta.y<0);
 before=camera.position.clone();frames(30);assert.ok(camera.position.distanceTo(before)<1e-5,'keyup stops '+code);
}
pose(true);before=camera.position.clone();down('KeyW');frames(20);up('KeyW');assert.ok(camera.position.y<before.y-20,'overhead forward descends along view');
pose();before=camera.position.clone();down('KeyD');frames(1);up('KeyD');const normal=camera.position.distanceTo(before);
pose();before=camera.position.clone();down('KeyD');down('KeyE');frames(1);up('KeyD');up('KeyE');assert.ok(Math.abs(camera.position.distanceTo(before)-normal)<1e-6,'normalized diagonal '+JSON.stringify({normal,diagonal:camera.position.distanceTo(before),position:camera.position.toArray()}));
pose();before=camera.position.clone();down('KeyD');down('ShiftLeft');frames(1);up('KeyD');up('ShiftLeft');assert.ok(Math.abs(camera.position.distanceTo(before)/normal-3)<1e-6,'Shift boosts 3x');
for(const stop of [()=>dom.emit('blur'),()=>dom.ownerDocument.defaultView.emit('blur'),()=>{dom.ownerDocument.hidden=true;dom.ownerDocument.emit('visibilitychange');dom.ownerDocument.hidden=false;}]){
 pose();down('KeyW');frames(2);stop();before=camera.position.clone();frames(30);assert.ok(camera.position.distanceTo(before)<1e-5,'focus loss clears held keys');
}
dom.ownerDocument.activeElement={tagName:'INPUT'};assert.equal(down('KeyW'),false,'typing outside viewport untouched');
pose();assert.equal(dom.emit('keydown',{code:'KeyW',target:{tagName:'INPUT'}}),false);
// Terrain descent stops without trapping lateral escape or upward movement.
camera.position.set(9000,3,9000);state.controls.target.set(9000,3,8950);state.controls.update();frames(1);dom.focus();
down('KeyQ');frames(120);up('KeyQ');assert.ok(camera.position.y>=2);before=camera.position.clone();down('KeyD');frames(30);up('KeyD');assert.ok(camera.position.distanceTo(before)>1);down('KeyE');frames(30);up('KeyE');assert.ok(camera.position.y>3);
action('port');assert.ok(camera.position.distanceTo(port)<1e-4);
// Actual container collision: approach a two-tier stack, then back out and rise.
const box=layout.get(selectedRecord.id),terminal=box.terminal;
const start=spatial.localToWorld(terminal,box.x-box.length/2-5,box.z),aim=spatial.localToWorld(terminal,box.x+40,box.z);
state.controls.maxPolarAngle=Math.PI/2-.025;camera.position.set(start[0],4,start[1]);state.controls.target.set(aim[0],2,aim[1]);state.controls.update();frames(1);dom.focus();
down('KeyW');frames(240);up('KeyW');
const bounds=load('src/pages/ContainerYard/navigationClearance.ts').buildNavigationClearance(layout.values(),true);
assert.ok(!Number.isFinite(bounds.obstructionTop(camera.position.x,camera.position.y,camera.position.z)),'flight must stop outside containers');
before=camera.position.clone();down('KeyS');frames(40);up('KeyS');assert.ok(camera.position.distanceTo(before)>1,'can back away from collision');
down('KeyE');frames(120);up('KeyE');assert.ok(camera.position.y>6,'can rise out of constrained aisle');action('port');assert.ok(camera.position.distanceTo(port)<1e-4);
for(const slot of slots)slot?.cleanup?.();assert.equal(dom.count(),0);assert.equal(dom.ownerDocument.count(),0);assert.equal(state.controls,undefined);
assert.equal(dom.ownerDocument.defaultView.count(),0,'window keyboard handlers cleaned');
console.log(JSON.stringify({result:'PASS',checks:'actual controls: all held/released flight keys and arrows, overhead and oblique travel, normalized diagonals, 3x Shift, focus/visibility cleanup, terrain/container clearance and escape, presets, wheel, pan/orbit, preserved filters/selection, listener cleanup'}));
