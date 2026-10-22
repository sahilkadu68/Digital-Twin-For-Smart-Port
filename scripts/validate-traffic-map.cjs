const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function mod(src,req){const m={exports:{}};vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:m,exports:m.exports,require:req,console,AbortController,TextDecoder,crypto:require('node:crypto').webcrypto,fetch:async()=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync('jnpa_roads_candidate.geojson');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}})});return m.exports}
const scope=mod(fs.readFileSync('src/data/jnpa/roadDisplayScope.ts','utf8'),()=>({}));
const sim=mod(fs.readFileSync('src/data/jnpa/simulatedTraffic.ts','utf8'),()=>({}));

const base=process.env.VALIDATION_API_BASE||'http://localhost:8082/api/v1';
const api={apiFetch:async(path,options)=>{const r=await fetch(base+path,options);if(!r.ok)throw Error('API '+r.status);return r.json()}};
const realService=mod(fs.readFileSync('src/services/trafficService.ts','utf8'),n=>n==='./api'?api:sim);
let responseMode='live';const requests=[],deferred={};
const trafficService={getTrafficRecords:(scenario,ids,signal)=>{
 let p;
 if(responseMode==='empty')p=Promise.resolve(new Map());
 else if(responseMode==='error')p=Promise.reject(Error('Injected API outage'));
 else if(responseMode==='deferred')p=new Promise(resolve=>{deferred[scenario]={resolve,signal}});
 else p=realService.getTrafficRecords(scenario,ids,signal);
 if(responseMode!=='deferred')requests.push(p);
 return p;
}};

let geometryBuilds=0;const callbacks={};
let slots=[],effects=[],cursor=0,pending=[],dirty=false,mode='port';const attached=new Set(),listeners=new Set(),fits=[];
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={
useState(init){const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>{const next=typeof v==='function'?v(slots[i]):v;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true}}]},
useRef(init){const i=cursor++;return slots[i]??(slots[i]={current:init})},
useMemo(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value},
useEffect(fn,deps){const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push({i,fn,deps})}
};
class Polyline{constructor(f){this.feature=f}getBounds(){return{intersects:()=>true}}}
const map={getPane:()=>({style:{}}),createPane:()=>({style:{}}),getBounds:()=>({}),latLngToContainerPoint:p=>({x:(Array.isArray(p)?p[1]:p.lng)*10000,y:(Array.isArray(p)?p[0]:p.lat)*10000}),containerPointToLatLng:()=>({}),distance:()=>7,on:(names,cb)=>{listeners.add(cb);callbacks[names]=cb},off:(names,cb)=>{listeners.delete(cb);if(callbacks[names]===cb)delete callbacks[names]},fitBounds:(b,o)=>fits.push({b,o})};
class Control{addTo(){this.onAdd();return this}remove(){}}
const leaflet={Control,Polyline,DomEvent:{disableClickPropagation(){},disableScrollPropagation(){},off(){}},DomUtil:{create:()=>({style:{}})},canvas:()=>({remove(){}}),geoJSON:data=>{geometryBuilds++;const g={features:data.features,setStyle(fn){this.styles=data.features.map(f=>fn(f))},n:data.features.length,eachLayer:fn=>data.features.forEach(f=>fn(new Polyline(f))),addTo(){attached.add(g);return g},remove(){attached.delete(g)}};return g}};
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
const src=fs.readFileSync('src/components/map/RoadNetworkLayer.tsx','utf8').replace(/import roadsUrl from [^\n]+/,"const roadsUrl = ''");
const component=mod(src,name=>name==='react'?react:name==='react-dom'?{createPortal:v=>v}:name==='react-leaflet'?{useMap:()=>map}:name==='leaflet'?leaflet:name==='react/jsx-runtime'?jsx:name.includes('roadDisplayScope')?scope:name.includes('simulatedTraffic')?sim:name.includes('trafficService')?trafficService:{}).default;
let tree;
function flush(){for(let n=0;n<15;n++){dirty=false;cursor=0;pending=[];tree=component({mode,onModeChange:m=>{mode=m;dirty=true}});pending.forEach(p=>effects[p.i]?.cleanup?.());pending.forEach(p=>effects[p.i]={deps:p.deps,cleanup:p.fn()});if(!dirty)return}throw Error('Render loop')}
function search(node,test){if(!node||typeof node!=='object')return; if(test(node))return node;const cs=node.props?.children;for(const c of Array.isArray(cs)?cs:[cs]){const r=search(c,test);if(r)return r}}
const find=test=>search(tree,test);

async function settle(){for(let i=0;i<4;i++){flush();await Promise.allSettled(requests.splice(0));await new Promise(r=>setTimeout(r,10));flush()}}
const source=JSON.parse(fs.readFileSync('jnpa_roads_candidate.geojson')).features,ids=source.map(f=>f.properties['@id']);
function matchColors(layer,records){layer.features.forEach((f,i)=>assert.equal(layer.styles[i].color,records.get(f.properties['@id']).color))}
function allGrey(){assert.ok([...attached][0].styles.every(s=>s.color==='#94a3b8'))}
(async()=>{
await settle();assert.equal([...attached][0].n,1045);const layer=[...attached][0],builds=geometryBuilds;
const normal=await realService.getTrafficRecords('normal',ids);matchColors(layer,normal);
const select=()=>find(n=>n.type==='select');
select().props.onChange({target:{value:'peak'}});flush();allGrey();await settle();
const peak=await realService.getTrafficRecords('peak',ids);matchColors(layer,peak);assert.equal(geometryBuilds,builds);
const details=find(n=>n.type==='details');details.props.ref.current={open:false};
const p=source.find(f=>scope.intersectsInspectionScope(f.geometry)).geometry.coordinates[0];
callbacks.click({latlng:{lat:p[1],lng:p[0],toBounds:()=>({})}});flush();assert.ok(details.props.ref.current.open);
assert.ok(find(n=>n.type==='p'&&JSON.stringify(n.props.children)?.includes('Persisted simulation generated:')));
responseMode='empty';select().props.onChange({target:{value:'severe'}});await settle();allGrey();
assert.ok(find(n=>n.type==='p'&&typeof n.props.children==='string'&&n.props.children.startsWith('No persisted traffic')));
responseMode='error';select().props.onChange({target:{value:'normal'}});await settle();allGrey();assert.ok(find(n=>n.props.role==='alert'));
responseMode='live';find(n=>n.type==='button'&&n.props.children==='Retry traffic').props.onClick();await settle();matchColors(layer,normal);
responseMode='deferred';select().props.onChange({target:{value:'peak'}});flush();select().props.onChange({target:{value:'normal'}});flush();
deferred.normal.resolve(normal);await settle();deferred.peak.resolve(peak);await settle();assert.ok(deferred.peak.signal.aborted);matchColors(layer,normal);
responseMode='live';find(n=>n.type==='button'&&n.props.children==='Full road network').props.onClick();await settle();assert.equal([...attached][0].n,2893);matchColors([...attached][0],normal);
find(n=>n.type==='button'&&n.props.children==='Port view').props.onClick();await settle();assert.equal([...attached][0].n,1045);
find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:false}});flush();assert.equal(attached.size,0);
effects.forEach(e=>e?.cleanup?.());assert.equal(listeners.size,0);
console.log('PASS: real component and traffic service with live HTTP values drive colors/details; scenario loading clears stale colors; empty/error/retry; late response ignored; full/port scopes; visibility and cleanup. Leaflet/React hooks mocked, not browser validation.');
})().catch(e=>{console.error(e);process.exitCode=1});
