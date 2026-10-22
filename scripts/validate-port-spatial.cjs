// Read-only geometry and inventory projection checks. No database writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),crypto=require('node:crypto');
const cache={};
function load(path){if(cache[path])return cache[path];const module={exports:{}};const requireLocal=name=>name.includes('yardAssignments')?load('src/data/yardAssignments.ts'):name.includes('equipmentPlacement')?load('src/data/jnpa/equipmentPlacement.ts'):name.includes('yardGeometry')?load('src/data/yardGeometry.ts'):name.includes('portSpatial')?load('src/data/jnpa/portSpatial.ts'):require(name);
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:requireLocal});return cache[path]=module.exports;}
const spatial=load('src/data/jnpa/portSpatial.ts'),grids=load('src/data/yardGeometry.ts').YARD_GRIDS,quality=load('src/utils/inventoryQuality.ts');
const THREE=require('three'),meshes=load('src/pages/ContainerYard/portMeshes.ts');
const land=meshes.surfaceGeometry(spatial.PORT_LAND,5),pos=land.attributes.position;
const triangles=[];
for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
 if(Math.abs(a.y)<.01&&Math.abs(b.y)<.01&&Math.abs(c.y)<.01)triangles.push(new THREE.Triangle(a,b,c));}
const closest=new THREE.Vector3();
function supported([x,z]){const p=new THREE.Vector3(x,0,z);return triangles.some(t=>t.closestPointToPoint(p,closest).distanceTo(p)<.1);}
let landSamples=0;
function inside([x,y],poly){let value=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])value=!value;}return value;}
const expected={NSFT:680,NSICT:600,NSIGT:330,APMT:712,BMCT:2000,NSDT:445};
assert.deepEqual([...spatial.JNPA_TERMINALS.map(t=>t.id)].sort(),Object.keys(expected).sort());
let bankCorners=0;
for(const t of spatial.JNPA_TERMINALS){
 assert.ok(t.width>0&&t.depth>0);
 // Check the actual triangulated land, including boundary points, not only
 // the yard polygon that could itself be floating above the water plane.
 for(let i=0;i<t.footprint.length;i++)for(let j=0;j<=20;j++){
  const a=t.footprint[i],b=t.footprint[(i+1)%t.footprint.length],f=j/20;
  assert.ok(supported([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]),t.id+' footprint edge lacks land');landSamples++;
 }
 assert.ok(Math.abs(Math.hypot(t.quay[1][0]-t.quay[0][0],t.quay[1][1]-t.quay[0][1])-expected[t.id])<1e-7);
 for(let i=0;i<grids[t.id].blocks;i++){const b=spatial.blockLayout(t,i);assert.ok(b.x>=0&&b.z>=0);
 const building=spatial.terminalBuildingLayout(t);
 assert.ok(building.z-building.depth/2-2>b.z+b.depth || building.z+building.depth/2+2<b.z,'warehouse must not overlap a bank');
 for(const p of [[b.x,b.z],[b.x+b.width,b.z],[b.x,b.z+b.depth],[b.x+b.width,b.z+b.depth]]){
  const world=spatial.localToWorld(t,...p);
  assert.ok(inside(world,t.footprint),t.id+' bank '+i+' outside traced footprint');
  assert.ok(supported(world),t.id+' bank '+i+' lacks rendered land');bankCorners++;
 }}
}
const n=spatial.JNPA_TERMINALS.find(t=>t.id==='NSFT'),ic=spatial.JNPA_TERMINALS.find(t=>t.id==='NSICT'),ig=spatial.JNPA_TERMINALS.find(t=>t.id==='NSIGT');
assert.deepEqual(n.quay[1],ic.quay[0]);assert.deepEqual(ic.quay[1],ig.quay[0]);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('jnpa_roads_candidate.geojson')).digest('hex'),'4f115d3293cc7dca3d702f142d8236e044d1106b56b0fef4479a8bdd7724fbcb');
(async()=>{
 const res=await fetch((process.env.VALIDATION_API_BASE||'http://localhost:8081/api/v1')+'/containers');assert.ok(res.ok);
 const records=await res.json(),before=JSON.stringify(records);let rendered=0;const byTerminal={};
 const eligible=records.filter(c=>c.status!=='gate-out'&&quality.validPosition(c)),layout=spatial.buildContainerLayout(eligible);
 assert.equal(layout.size,eligible.length);
 const stacks=new Map();
 for(const c of records){if(c.status==='gate-out'||!quality.validPosition(c))continue;
  Object.freeze(c);const p=layout.get(c.id);assert.ok(p);
  assert.ok(p.length<=14.5&&p.width<3.3&&p.height<2.95);assert.ok([p.x,p.y,p.z].every(Number.isFinite));
  assert.ok(Math.abs(p.y-p.height/2-p.bottom)<1e-10);
  const b=spatial.blockLayout(p.terminal,Number(c.block.split('-').pop())-1);
  assert.ok(p.x-p.length/2>=b.x&&p.x+p.length/2<=b.x+b.width&&p.z-p.width/2>=b.z&&p.z+p.width/2<=b.z+b.depth);
  const list=stacks.get(p.stackKey)||[];list.push(p);stacks.set(p.stackKey,list);
  byTerminal[c.terminal]=(byTerminal[c.terminal]||0)+1;rendered++;
 }
 assert.equal(JSON.stringify(records),before);assert.equal(rendered,11343);
 assert.equal(Object.keys(byTerminal).length,6);
 let maxDisplayTier=0,packedStacks=0;
 for(const list of stacks.values()){
  list.sort((a,b)=>a.displayTier-b.displayTier);assert.equal(list[0].bottom,spatial.BANK_TOP_Y);
  maxDisplayTier=Math.max(maxDisplayTier,list.length);if(list[0].issues.length)packedStacks++;
  for(let i=1;i<list.length;i++){assert.equal(list[i].bottom,list[i-1].top);assert.ok(list[i].length<=list[i-1].length);}
 }
 const reversed=spatial.buildContainerLayout([...eligible].reverse());
 for(const [id,p]of layout)assert.equal(reversed.get(id).y,p.y,'layout must not depend on API order');
 // Filters retain actual lower supports at the same coordinates, without
 // inventing records or altering the displayed positions of matching records.
 const visible=eligible.filter(c=>c.status==='import'),context=spatial.filteredStackSupports(visible,layout),shown=new Set([...visible,...context].map(c=>c.id));
 for(const c of visible){const p=layout.get(c.id);for(const q of stacks.get(p.stackKey))if(q.displayTier<p.displayTier)assert.ok(shown.has(q.record.id));}
 const base=eligible[0],sample=[{...base,id:'low',level:1,type:'40ft'},{...base,id:'high',level:2,type:'40ft-HC'}];
 const mixedHeights=spatial.buildContainerLayout(sample);
 assert.equal(mixedHeights.get('high').bottom,spatial.BANK_TOP_Y+2.591);
 assert.equal(mixedHeights.get('high').top,spatial.BANK_TOP_Y+2.591+2.896);
 const orphan=spatial.buildContainerLayout([{...base,id:'orphan',level:4}]);assert.equal(orphan.size,0,'unresolved levels must not be visually reassigned');
 const duplicate=spatial.buildContainerLayout([{...base,id:'a',level:2},{...base,id:'b',level:2}]);assert.equal(duplicate.size,0);assert.ok(maxDisplayTier<=4);assert.equal(quality.inventoryQuality(records).collidingSlots,0);assert.equal(quality.inventoryQuality(records).unresolvedAssignments,0);
 land.dispose();
 console.log(JSON.stringify({result:'PASS',landSamples,bankCorners,rendered,byTerminal,stacks:stacks.size,packedStacks,maxDisplayTier,filterSupportContext:context.length,quayLengthsMetres:expected,checks:'all six terminals; grounded boxes; exact cumulative heights; no stack gaps/overlaps; block bounds; stable IDs and metadata; filter supports; warehouses clear of banks; land support; GeoJSON integrity'}));
})().catch(e=>{console.error(e);process.exitCode=1});
