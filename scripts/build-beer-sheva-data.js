'use strict';
/**
 * Build Beer Sheva shelters data.
 * Source: data.gov.il CKAN API resource e191d913-11e4-4d87-a4b2-91587aab6611
 *
 * Run: node scripts/build-beer-sheva-data.js
 */

const fetch = require('node-fetch');
const fs = require('fs'), path = require('path');

const URL = 'https://data.gov.il/api/3/action/datastore_search?resource_id=e191d913-11e4-4d87-a4b2-91587aab6611&limit=10000';

async function main() {
  console.log('Fetching Beer Sheva shelters from data.gov.il...');
  const res = await fetch(URL, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error('data.gov.il: success=false');

  const records = json.result.records;
  console.log(`Got ${records.length} records`);

  // Inspect first record to understand fields
  if (records.length > 0) {
    console.log('Sample record keys:', Object.keys(records[0]));
    console.log('Sample record:', JSON.stringify(records[0], null, 2));
  }

  const shelters = records.map((rec, i) => {
    const lat = parseFloat(rec.lat ?? rec.LAT ?? rec.latitude ?? rec.Latitude ?? '');
    const lon = parseFloat(rec.lon ?? rec.LON ?? rec.longitude ?? rec.Longitude ?? '');
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) return null;

    const rawName = rec.name ?? rec.NAME ?? rec['שם'] ?? rec['כתובת'] ?? '';
    const name = rawName
      ? (rawName.startsWith('מקלט') ? rawName : `מקלט ${rawName}`)
      : `מקלט #${rec._id || i + 1}`;

    return {
      id: `gov_bs_${rec._id || i}`,
      lat,
      lon,
      name,
      address: rec.address ?? rec.ADDRESS ?? rec['כתובת'] ?? rec.street ?? '',
      city: 'באר שבע',
      capacity: rec.capacity ?? rec.CAPACITY ?? rec['קיבולת'] ?? '',
      type: 'מקלט ציבורי',
      source: 'gov',
      category: 'public',
    };
  }).filter(Boolean);

  const out = path.join(__dirname, '..', 'data', 'beer-sheva-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
