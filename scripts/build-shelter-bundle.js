'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'all-shelters.json');
const VERSION_FILE = path.join(DATA_DIR, 'shelter-bundle-version.json');

const KEEP_FIELDS = ['id', 'lat', 'lon', 'name', 'address', 'city', 'category', 'source'];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) {
    if (obj[f] !== undefined) out[f] = obj[f];
  }
  return out;
}

function main() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('-shelters.json') && f !== 'all-shelters.json')
    .sort();

  console.log(`Found ${files.length} shelter files in ${DATA_DIR}`);

  let allShelters = [];
  const cityStats = {};

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const shelters = Array.isArray(raw) ? raw : [];
    const trimmed = shelters.map(s => pick(s, KEEP_FIELDS));
    allShelters = allShelters.concat(trimmed);

    // Track per-city count using the city field from first shelter, or filename
    const cityName = (trimmed[0] && trimmed[0].city) || file.replace('-shelters.json', '');
    cityStats[cityName] = (cityStats[cityName] || 0) + trimmed.length;
  }

  console.log(`Total shelters: ${allShelters.length}`);
  console.log(`Cities: ${Object.keys(cityStats).length}`);

  // Write bundle
  const jsonStr = JSON.stringify(allShelters);
  fs.writeFileSync(OUTPUT_FILE, jsonStr, 'utf-8');

  const fileSizeKB = (Buffer.byteLength(jsonStr, 'utf-8') / 1024).toFixed(1);
  const fileSizeMB = (Buffer.byteLength(jsonStr, 'utf-8') / (1024 * 1024)).toFixed(2);
  console.log(`Bundle size: ${fileSizeKB} KB (${fileSizeMB} MB)`);

  // Calculate hash
  const hash = crypto.createHash('sha256').update(jsonStr).digest('hex');

  const versionInfo = {
    version: hash,
    count: allShelters.length,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionInfo, null, 2), 'utf-8');

  console.log(`Version hash: ${hash.slice(0, 16)}...`);
  console.log(`Written: ${OUTPUT_FILE}`);
  console.log(`Written: ${VERSION_FILE}`);

  // Top cities
  const sorted = Object.entries(cityStats).sort((a, b) => b[1] - a[1]);
  console.log('\nTop 10 cities by shelter count:');
  for (const [city, count] of sorted.slice(0, 10)) {
    console.log(`  ${city}: ${count}`);
  }
}

main();
