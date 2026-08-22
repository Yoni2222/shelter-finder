// Lists every shelter whose English address disagrees with the Hebrew one, so
// the bad ones can be corrected by hand.
//
//   node scripts/report-address-mismatches.js            # all cities
//   node scripts/report-address-mismatches.js haifa      # one city
//
// Writes address-mismatches.csv in the project root (UTF-8 with BOM so Excel
// renders the Hebrew correctly).

const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const only = process.argv[2];
const files = fs.readdirSync(dataDir)
  .filter(f => f.endsWith('-shelters.json') && f !== 'all-shelters.json')
  .filter(f => !only || f.includes(only));

const HEBREW = /[֐-׿]/;

function houseNumber(s) {
  const m = String(s || '').match(/\d+/);
  return m ? m[0] : null;
}

/** Why this record looks wrong, or null when it looks fine. */
function problem(s) {
  const he = (s.address || '').trim();
  const en = (s.addressEn || '').trim();

  if (!he) return null;                       // nothing to compare against
  if (!en) return 'missing English address';
  if (HEBREW.test(en)) return 'English field still contains Hebrew';

  const hn = houseNumber(he);
  const en_hn = houseNumber(en);

  if (hn && !en_hn) return 'no house number in English';
  if (hn && en_hn && hn !== en_hn) return `house number differs (${hn} vs ${en_hn})`;
  return null;
}

const csvCell = v => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const rows = [];
const perCity = {};

for (const file of files) {
  const city = file.replace('-shelters.json', '');
  const shelters = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  if (!Array.isArray(shelters)) continue;

  shelters.forEach((s, index) => {
    const issue = problem(s);
    if (!issue) return;

    perCity[city] = (perCity[city] || 0) + 1;
    rows.push([
      city,
      index + 1,            // position in the file, for finding it by eye
      s.id || '',
      s.name || '',
      s.address || '',
      s.addressEn || '',
      issue,
      s.lat,
      s.lon,
    ]);
  });
}

const header = ['city', 'row_in_file', 'id', 'name', 'address_he', 'address_en_current', 'issue', 'lat', 'lon'];
const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

const out = path.join(process.cwd(), 'address-mismatches.csv');
fs.writeFileSync(out, csv, 'utf8');

console.log(`Wrote ${out}`);
console.log(`${rows.length} records need attention across ${Object.keys(perCity).length} cities.\n`);

Object.entries(perCity)
  .sort((a, b) => b[1] - a[1])
  .forEach(([city, n]) => console.log(`  ${String(n).padStart(4)}  ${city}`));
