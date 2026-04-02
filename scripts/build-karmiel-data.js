'use strict';
/**
 * Build Karmiel (כרמיאל) shelters data.
 * Source: Municipality website - 108 shelters.
 * This script:
 *   1. Creates karmiel-input.json from raw data
 *   2. Geocodes via Google Geocoding API
 *   3. Writes karmiel-output.json and data/karmiel-shelters.json
 *
 * Run: GOOGLE_API_KEY=... node scripts/build-karmiel-data.js
 */

const fetch = require('node-fetch');
const fs = require('fs'), path = require('path');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = envFile.match(/GOOGLE_MAPS_API_KEY=(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
})();

// Raw data: shelterNumber|neighborhood|address
const RAW_DATA = `101|אזור תעשייה|המלאכה 13 א'
102|אזור תעשייה|המלאכה 22
103|אזור תעשייה|המלאכה 28
104|אזור תעשייה|החשמל 25
105|אזור תעשייה|הטוחן 4 א'
106|אזור תעשייה|מור תעשיה
107|אזור תעשייה|החרושת 37 א'
108|אזור תעשייה|החרושת 33 א'
109|אזור תעשייה|החרושת 29 א'
110|אזור תעשייה|להב 8 א'
111|אזור תעשייה|להב 4 א'
112|אזור תעשייה|המגל 2 א'
113|אזור תעשייה|המגל 6 א'
114|אזור תעשייה|המגל 9
115|אזור תעשייה|המגל 12 א'
116|אזור תעשייה|המגל 20
117|אזור תעשייה|המגל 17
118|אזור תעשייה|חרמש 9-15
119|אזור תעשייה|חרמש 7
120|אזור תעשייה|חרמש 1
121|אזור תעשייה|החרושת 9-13
122|אזור תעשייה|החרושת 7 א'
123|אזור תעשייה|החרושת 7
201|המייסדים|משעול הסביונים 4 א'
202|המייסדים|החרוב 10
203|המייסדים|משעול הסביונים 31 א'
204|המייסדים|צה"ל 80 א'
205|המייסדים|צה"ל 27 ב'
206|המייסדים|צה"ל 47 ב'
207|המייסדים|צה"ל 69 ב'
208|המייסדים|צה"ל 89 ב'
209|המייסדים|הגליל 7 א'
210|המייסדים|נשיאי ישראל 11 א'
211|המייסדים|הגליל 8
212|המייסדים|הגליל 10
213|המייסדים|הגליל 16 א'
214|המייסדים|הגליל 22 א'
215|המייסדים|הגליל 30
301|שגיא|עצמון 9 א'
302|שגיא|עצמון 37 א'
303|שגיא|עצמון 43 א'
304|שגיא|עצמון 55 א'
305|שגיא|עצמון 73
306|שגיא|עצמון 83 א'
307|שגיא|עצמון 95 ב'
308|שגיא|עצמון 103
309|מגדים|משגב 15 ט'
310|מגדים|משגב 7
319|מגדים|רמים 29
320|מגדים|אשור 3
321|מגדים|אשור 7
322|מגדים|רמים 33
323|מגדים|אשור 13
324|מגדים|אשור 19
325|מגדים|רמים 69
601|מגדים|כפר הילדים
602|מגדים|כפר הילדים
603|מגדים|כפר הילדים
604|מגדים|כפר הילדים
605|מגדים|כפר הילדים
606|מגדים|כפר הילדים
401|דרומית|איריס השושנים 2
402|דרומית|השושנים 10
403|דרומית|השושנים 36 א'
404|דרומית|השושנים 78 א'
405|דרומית|השושנים 118
406|דרומית|השושנים 140
407|דרומית|השושנים 148
408|דרומית|השושנים 158
409|דרומית|האשל 19
410|דרומית|ליבנה 14
411|דרומית|מורד הגיא 105 א'
412|דרומית|ערבה 6
413|דרומית|ערבה 44
414|דרומית|ערבה 78
415|דרומית|צאלון 42 א'
416|דרומית|צאלון 17 א'
417|דרומית|מורד הגיא 58
418|דרומית|הרדוף 20
419|דרומית|אטד 1
420|דרומית|לוטם 1
421|דרומית|יערה אלה 7
422|דרומית|מרווה/חוחית ליד 30
423|דרומית|הפרחים 7 א'
424|דרומית|משעול חצב 8 א'
425|דרומית|משעול חצב 4 א'
426|דרומית|מורד הגיא 17 ג'
501|גבעת רם|שביל כסלו/אסיף 26
502|גבעת רם|שביל חשון 1 א'
503|גבעת רם|קטיף 27
504|גבעת רם|שביל שבט 10
505|גבעת רם|ביכורים 28
506|גבעת רם|אסיף 85
507|גבעת רם|בציר 39
508|גבעת רם|תמוז 31
509|גבעת רם|שביל סיון 19
510|גבעת רם|קציר 52
511|גבעת רם|הזורעים 61
512|גבעת רם|הזורעים 12`;

function cleanAddress(raw) {
  let addr = raw.trim();

  // Special cases
  if (addr === 'מור תעשיה') return 'מור, אזור תעשייה';
  if (addr === 'כפר הילדים') return 'כפר הילדים';
  if (addr === 'מרווה/חוחית ליד 30') return 'מרווה 30';
  if (addr.startsWith('שביל כסלו/אסיף')) return addr.replace('שביל כסלו/אסיף', 'אסיף');

  // Range addresses: take first number
  addr = addr.replace(/(\d+)-\d+/, '$1');

  // Remove trailing apartment/entrance suffixes: א', ב', ג', ט' etc.
  addr = addr.replace(/\s+[א-ת]'$/, '');

  return addr;
}

function parseRawData() {
  const lines = RAW_DATA.trim().split('\n');
  const entries = [];
  const seenKfarHayeladim = false;

  for (const line of lines) {
    const [num, neighborhood, rawAddress] = line.split('|');

    // For כפר הילדים entries, only keep one
    if (rawAddress.trim() === 'כפר הילדים') {
      if (entries.some(e => e.address === 'כפר הילדים')) continue;
    }

    const cleaned = cleanAddress(rawAddress);
    entries.push({
      name: `מקלט ${num}`,
      address: cleaned,
      city: 'כרמיאל',
      neighborhood: neighborhood.trim(),
      shelterNum: num.trim(),
    });
  }

  return entries;
}

async function geocode(address, city) {
  const query = `${address}, ${city}`;
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?' + new URLSearchParams({
    address: query + ', ישראל',
    key: GOOGLE_API_KEY,
    language: 'he',
    region: 'il',
  });
  const res = await fetch(url, { timeout: 10000 });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK' || !data.results || !data.results[0]) return null;
  const loc = data.results[0].geometry.location;
  const addressEn = data.results[0].formatted_address || '';
  return { lat: loc.lat, lon: loc.lng, addressEn };
}

function inKarmielBounds(lat, lon) {
  return lat >= 32.90 && lat <= 32.94 && lon >= 35.28 && lon <= 35.33;
}

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error('ERROR: No Google API key found. Set GOOGLE_API_KEY env var.');
    process.exit(1);
  }

  // Step 1: Parse and create input JSON
  const entries = parseRawData();
  const inputPath = path.join(__dirname, 'karmiel-input.json');
  fs.writeFileSync(inputPath, JSON.stringify(entries, null, 2), 'utf8');
  console.log(`Created ${inputPath} with ${entries.length} entries`);

  // Step 2: Geocode
  console.log(`\nGeocoding ${entries.length} addresses...`);
  const shelters = [];
  const failures = [];
  const outOfBounds = [];
  let geocodeOk = 0;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const coords = await geocode(e.address, e.city);

    if (!coords) {
      failures.push({ num: e.shelterNum, address: e.address });
      console.warn(`  [${i+1}/${entries.length}] FAIL - no coords for: ${e.address}`);
    } else if (!inKarmielBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ num: e.shelterNum, address: e.address, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${entries.length}] OUT OF BOUNDS: ${e.address} → (${coords.lat}, ${coords.lon})`);
      // Still include it but flag it
      shelters.push({
        id: `כרמיאל-${shelters.length + 1}`,
        lat: coords.lat,
        lon: coords.lon,
        name: e.name,
        address: e.address,
        city: 'כרמיאל',
        neighborhood: e.neighborhood,
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: coords.addressEn || '',
        _outOfBounds: true,
      });
      geocodeOk++;
    } else {
      geocodeOk++;
      shelters.push({
        id: `כרמיאל-${shelters.length + 1}`,
        lat: coords.lat,
        lon: coords.lon,
        name: e.name,
        address: e.address,
        city: 'כרמיאל',
        neighborhood: e.neighborhood,
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
        addressEn: coords.addressEn || '',
      });
    }

    if ((i + 1) % 20 === 0) {
      console.log(`  Geocoded ${i+1}/${entries.length}...`);
    }

    // 200ms delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  // Step 3: Write outputs
  // Remove _outOfBounds flag for final output
  const cleanShelters = shelters.map(s => {
    const { _outOfBounds, ...rest } = s;
    return rest;
  });

  const outputPath = path.join(__dirname, 'karmiel-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(cleanShelters, null, 2), 'utf8');
  console.log(`\nSaved ${outputPath}`);

  const dataPath = path.join(__dirname, '..', 'data', 'karmiel-shelters.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(cleanShelters, null, 2), 'utf8');
  console.log(`Saved ${dataPath}`);

  // Step 4: Stats
  console.log(`\n=== STATS ===`);
  console.log(`Total input entries: ${entries.length}`);
  console.log(`Geocoded OK: ${geocodeOk}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Out of bounds: ${outOfBounds.length}`);
  console.log(`Final shelter count: ${cleanShelters.length}`);

  if (failures.length > 0) {
    console.log(`\nFailed addresses:`);
    failures.forEach(f => console.log(`  - מקלט ${f.num}: ${f.address}`));
  }
  if (outOfBounds.length > 0) {
    console.log(`\nOut-of-bounds (included but check manually):`);
    outOfBounds.forEach(o => console.log(`  - מקלט ${o.num}: ${o.address} → (${o.lat}, ${o.lon})`));
  }
}

main().catch(e => { console.error(e.message); process.exit(1);
});
