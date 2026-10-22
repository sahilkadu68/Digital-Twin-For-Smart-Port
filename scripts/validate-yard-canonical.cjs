const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const cache={};function load(file){if(cache[file])return cache[file];const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:name=>name.includes('yardGeometry')?load('src/data/yardGeometry.ts'):name.includes('yardAssignments')?load('src/data/yardAssignments.ts'):name.includes('portSpatial')?load('src/data/jnpa/portSpatial.ts'):require(name)});return cache[file]=module.exports;}
const rules=load('src/data/yardAssignments.ts'),spatial=load('src/data/jnpa/portSpatial.ts'),eq=load('src/data/jnpa/equipmentPlacement.ts');
(async()=>{
 const base=process.env.VALIDATION_API_BASE||'http://localhost:8081/api/v1';
 const get=async path=>{const res=await fetch(base+path);assert.ok(res.ok,path);return res.json();};
 const [records,equipment,stats,report,terminals]=await Promise.all(['/containers','/equipment','/containers/stats','/reports/summary','/terminals'].map(get));
 assert.equal(records.length,11713);assert.equal(stats.totalContainers,records.length);assert.equal(report.totalContainers,records.length);
 const checked=rules.validatedStacks(records);assert.equal(checked.unresolved.length,0);assert.equal(spatial.buildContainerLayout(records).size,11343);
 assert.equal(equipment.length,30);const placements=spatial.JNPA_TERMINALS.flatMap(t=>eq.equipmentPlacements(t,equipment));
 assert.equal(placements.length,equipment.filter(e=>e.type==='rtg').length);assert.equal(new Set(placements.map(p=>p.id)).size,30);
 for(const p of placements){assert.equal(p.placementKind,'illustrative-within-stored-block');assert.ok(p.height-2>4*2.896+spatial.BANK_TOP_Y);}
 for(const terminal of terminals){const count=records.filter(c=>c.terminal===terminal.code).length;assert.equal(report.byTerminal[terminal.code],count);assert.equal((await get('/containers?terminal='+terminal.code)).length,count);}
 assert.equal(JSON.stringify(rules.planYardRepair(records).records),JSON.stringify(records),'corrected canonical API is already stable');
 // Corrupted fixture exercises duplicate levels, gaps, overflow, mixed lengths,
 // invalid source positions, provenance guards and historical gate-out records.
 const first=records.find(c=>c.status!=='gate-out'),fixture=Array.from({length:7},(_,i)=>({...first,id:'fixture-'+i,level:i===0?1:4,type:i%2?'20ft':'40ft'}));
 fixture.push({...first,id:'gone',status:'gate-out',level:9},{...first,id:'bad',row:999},{...first,id:'unverified',simulated:false});
 const original=JSON.stringify(fixture),plan=rules.planYardRepair(fixture);
 assert.equal(JSON.stringify(fixture),original);assert.ok(plan.unresolved.includes('bad'));assert.ok(plan.unresolved.includes('unverified'));
 assert.equal(plan.records.find(c=>c.id==='gone').level,9,'gate-out history preserved');
 assert.equal(rules.validatedStacks(plan.records.filter(c=>!plan.unresolved.includes(c.id))).unresolved.length,0);
 assert.equal(JSON.stringify(rules.planYardRepair(plan.records).records),JSON.stringify(plan.records),'repair idempotence');
 for(let i=0;i<fixture.length;i++)for(const key of Object.keys(fixture[i]))if(!['row','column','level'].includes(key))assert.equal(plan.records[i][key],fixture[i][key]);
 console.log(JSON.stringify({result:'PASS',total:records.length,occupying:11343,gateOut:370,stacks:checked.stacks.size,maxTier:4,equipment:equipment.length,renderedRTGs:placements.length,byTerminal:Object.fromEntries(spatial.JNPA_TERMINALS.map(t=>[t.id,eq.equipmentPlacements(t,equipment).length])),checks:'canonical API/report/terminal counts; four-high validity; unique RTGs; hoist clearance; deterministic repair; preserved IDs/status/terminal/history; unresolved fixtures flagged'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
