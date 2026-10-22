const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const shell = process.env.MONGOSH_PATH || (fs.existsSync('C:/mongosh-2.12.0-win32-x64/bin/mongosh.exe') ? 'C:/mongosh-2.12.0-win32-x64/bin/mongosh.exe' : 'mongosh');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_port_digital_twin';

console.log('Connecting to MongoDB and exporting...');
const code = 'EJSON.stringify(Object.fromEntries(db.getCollectionNames().sort().map(n=>[n,db.getCollection(n).find().toArray()])))';

try {
  const raw = execFileSync(shell, [uri, '--quiet', '--eval', `print(${code})`], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });

  const outPath = path.join(__dirname, '..', 'database_export.json');
  fs.writeFileSync(outPath, raw.trim(), 'utf8');
  console.log('Success! Exported database to:', outPath);
  console.log('File size:', (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2), 'MB');
} catch (err) {
  console.error('Export failed:', err.message);
  process.exit(1);
}
