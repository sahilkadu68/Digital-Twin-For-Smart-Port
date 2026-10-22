const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const shell = process.env.MONGOSH_PATH || (fs.existsSync('C:/mongosh-2.12.0-win32-x64/bin/mongosh.exe') ? 'C:/mongosh-2.12.0-win32-x64/bin/mongosh.exe' : 'mongosh');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_port_digital_twin';

const filePath = path.join(__dirname, '..', 'database_export.json');

if (!fs.existsSync(filePath)) {
  console.error('Error: database_export.json not found in project root!');
  process.exit(1);
}

console.log('Reading database_export.json...');
const content = fs.readFileSync(filePath, 'utf8');

// Use temp script to load EJSON into MongoDB
const tempScript = path.join(__dirname, 'temp_import.js');
const scriptContent = `
const data = EJSON.parse(${JSON.stringify(content)});
for (const [colName, docs] of Object.entries(data)) {
  if (docs && docs.length > 0) {
    db.getCollection(colName).drop();
    db.getCollection(colName).insertMany(docs);
    print('Imported ' + docs.length + ' documents into ' + colName);
  }
}
print('All collections imported successfully!');
`;

try {
  fs.writeFileSync(tempScript, scriptContent, 'utf8');
  console.log('Importing into MongoDB...');
  const res = execFileSync(shell, [uri, '--quiet', '--file', tempScript], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
  console.log(res);
} catch (err) {
  console.error('Import failed:', err.message);
  process.exit(1);
} finally {
  if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
}
