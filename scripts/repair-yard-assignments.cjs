// Dry-run by default. --apply writes only simulated container assignments and
// evidenced legacy equipment block prefixes, after a full EJSON backup.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { execFileSync } = require('node:child_process'), crypto = require('node:crypto'), ts = require('typescript');
const shell = process.env.MONGOSH_PATH || 'C:/mongosh-2.12.0-win32-x64/bin/mongosh.exe';
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_port_digital_twin';
function mongo(code) { return execFileSync(shell, [uri, '--quiet', '--eval', code], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim(); }
const cache = {};
function load(file) {
  if (cache[file]) return cache[file]; const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module, exports: module.exports, require: name => name.includes('yardGeometry') ? load('src/data/yardGeometry.ts') : require(name) });
  return cache[file] = module.exports;
}
const rules = load('src/data/yardAssignments.ts'), grids = load('src/data/yardGeometry.ts').YARD_GRIDS;
const snapshotCode = 'EJSON.stringify(Object.fromEntries(db.getCollectionNames().sort().map(n=>[n,db.getCollection(n).find().sort({_id:1}).toArray()])))';
const raw = mongo(`print(${snapshotCode})`), snapshot = JSON.parse(raw);
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = doc => typeof doc._id === 'string' ? doc._id : doc._id.$oid;
const containers = snapshot.containers.map(c => ({ ...c, id: id(c) }));
const plan = rules.planYardRepair(containers);
if (plan.unresolved.length) throw Error('Repair requires manual review; no writes: ' + plan.unresolved.join(','));
if (JSON.stringify(rules.planYardRepair(plan.records).records) !== JSON.stringify(plan.records)) throw Error('Non-idempotent assignment plan; no writes');
const updates = [], changes = [], fields = ['yard', 'block', 'row', 'column', 'level'];
for (let i = 0; i < containers.length; i++) {
  const before = containers[i], after = plan.records[i];
  if (!fields.some(k => before[k] !== after[k])) continue;
  const original = Object.fromEntries(fields.map(k => [k, before[k]])), corrected = Object.fromEntries(fields.map(k => [k, after[k]]));
  updates.push({ collection: 'containers', id: before._id, set: { ...corrected, assignmentCorrection: {
    policy: rules.ASSIGNMENT_POLICY, original, reason: 'Resolve simulated gaps, duplicate levels, incompatible lengths or overflow; same terminal/yard/block only.' } } });
  changes.push({ id: before.id, terminal: before.terminal, before: original, after: corrected });
}
const equipmentChanges = [];
for (const e of snapshot.equipment) {
  const g = grids[e.terminal], match = /^NS-(0[1-3])$/.exec(e.block || '');
  // Seeder derives NS-xx from terminal.substring(0,2); terminal + suffix identify
  // the intended schematic block, not a measured crane coordinate.
  if (!e.simulated || !g || !match || !['NSFT', 'NSICT', 'NSIGT'].includes(e.terminal)) continue;
  const block = `${g.prefix}-${match[1]}`;
  updates.push({ collection: 'equipment', id: e._id, set: { block, associationCorrection: {
    policy: rules.ASSIGNMENT_POLICY, originalBlock: e.block, reason: 'DataSeeder legacy NS prefix; retain terminal and block ordinal.' } } });
  equipmentChanges.push({ id: id(e), equipmentId: e.equipmentId, terminal: e.terminal, before: e.block, after: block });
}
const numbers = new Map(); for (const c of containers) numbers.set(c.containerNumber, (numbers.get(c.containerNumber) || 0) + 1);
const report = { policy: rules.ASSIGNMENT_POLICY, mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
  counts: { containers: containers.length, occupying: containers.filter(rules.occupiesYard).length, equipment: snapshot.equipment.length },
  changedContainers: changes.length, changedEquipment: equipmentChanges.length, unresolved: plan.unresolved,
  duplicateNumberGroupsRetainedForReview: [...numbers.values()].filter(n => n > 1).length,
  beforeHashes: Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, hash(v)])) };
if (process.argv.includes('--apply') && updates.length) {
  const folder = path.resolve('backups', 'yard-four-high-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'before.ejson'), raw, { flag: 'wx' });
  fs.writeFileSync(path.join(folder, 'plan.json'), JSON.stringify({ ...report, changes, equipmentChanges }, null, 2), { flag: 'wx' });
  // Fail on concurrent changes before the first write. Compare-and-set each full
  // original document too; an interrupted run is safe to rerun with a new backup.
  if (mongo(`print(${snapshotCode})`) !== raw) throw Error('Inventory changed after backup; no writes performed');
  const payload = updates.map(u => ({ ...u, original: snapshot[u.collection].find(d => id(d) === (typeof u.id === 'string' ? u.id : u.id.$oid)) }));
  const payloadFile = path.join(folder, 'updates.ejson');
  fs.writeFileSync(payloadFile, JSON.stringify(payload), { flag: 'wx' });
  const result = mongo(`const updates=EJSON.parse(require('fs').readFileSync(${JSON.stringify(payloadFile)},'utf8'));let changed=0;for(const u of updates){const r=db.getCollection(u.collection).updateOne(u.original,{$set:u.set});if(r.matchedCount!==1)throw Error('Concurrent edit; stop and review backup');changed+=r.modifiedCount;}print(changed);`);
  report.backup = folder; report.modifiedDocuments = Number(result);
  const after = JSON.parse(mongo(`print(${snapshotCode})`));
  report.afterHashes = Object.fromEntries(Object.entries(after).map(([k, v]) => [k, hash(v)]));
  for (const name of Object.keys(snapshot)) {
    if (!['containers', 'equipment'].includes(name) && hash(snapshot[name]) !== hash(after[name])) throw Error('Unrelated collection changed: ' + name);
    if (snapshot[name].length !== after[name].length) throw Error('Record count changed: ' + name);
  }
  for (const name of ['containers', 'equipment']) for (let i = 0; i < snapshot[name].length; i++) {
    const old = snapshot[name][i], current = after[name][i];
    for (const key of Object.keys(old)) if (!(name === 'containers' ? fields : ['block']).includes(key) && JSON.stringify(old[key]) !== JSON.stringify(current[key])) throw Error('Unrelated field changed: ' + name + ':' + id(old) + ':' + key);
  }
  fs.writeFileSync(path.join(folder, 'result.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
}
console.log(JSON.stringify(report, null, 2));

