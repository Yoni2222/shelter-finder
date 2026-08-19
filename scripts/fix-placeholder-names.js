// Municipal GIS exports write the literal string "<Null>" for a missing name,
// which then renders as "<Null>" in the app. Replace those with something a
// user can read: the shelter type plus its street address.
//
//   node scripts/fix-placeholder-names.js          # all cities
//   node scripts/fix-placeholder-names.js haifa    # one city

const fs = require('fs');
const path = require('path');

const PLACEHOLDER = /^(<null>|null|n\/a|na|-|--|undefined|)$/i;

const dataDir = path.join(process.cwd(), 'data');
const only = process.argv[2];
const files = fs.readdirSync(dataDir)
  .filter(f => f.endsWith('-shelters.json'))
  .filter(f => !only || f.includes(only));

function betterName(s) {
  const type = (s.type || '').trim();
  const addr = (s.address || '').trim();

  if (type && addr) return `${type} - ${addr}`;
  if (addr) return addr;
  if (type) return type;
  return 'מקלט ציבורי';
}

let changed = 0;
const examples = [];

for (const file of files) {
  const filePath = path.join(dataDir, file);
  const shelters = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(shelters)) continue;

  let fileChanged = 0;
  for (const s of shelters) {
    const name = (s.name == null ? '' : String(s.name)).trim();
    if (!PLACEHOLDER.test(name)) continue;

    const next = betterName(s);
    if (examples.length < 10) examples.push(`${file}: "${name}" -> "${next}"`);
    s.name = next;
    fileChanged++;
  }

  if (fileChanged > 0) {
    fs.writeFileSync(filePath, JSON.stringify(shelters, null, 2), 'utf8');
    console.log(`  ${file}: fixed ${fileChanged}`);
    changed += fileChanged;
  }
}

console.log(`\nDone: ${changed} placeholder names replaced across ${files.length} files.`);
if (examples.length) {
  console.log('\nExamples:');
  examples.forEach(e => console.log('  ' + e));
}
