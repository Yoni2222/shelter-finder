'use strict';
/**
 * Build Zichron Yaakov (זכרון יעקב) shelters data.
 * Source: Municipality - 13 public shelters + 3 approved protected spaces.
 * Run: node scripts/build-zichron-data.js
 */

const fs = require('fs'), path = require('path');
const https = require('https');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = envFile.match(/GOOGLE_MAPS_API_KEY=(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
})();

const RAW_DATA = [
  // 13 numbered public shelters
  { num: '1',  addr: 'השזיף 10',                          geocodeAddr: 'השזיף 10',            hood: 'וילות בחורש' },
  { num: '2',  addr: 'תרע"ב 16',                          geocodeAddr: 'תרעב 16',             hood: 'מערב המושבה' },
  { num: '3',  addr: 'ביאליק 7',                          geocodeAddr: 'ביאליק 7',            hood: 'יעקב' },
  { num: '4',  addr: 'העליה 18',                           geocodeAddr: 'העליה 18',            hood: 'קאנטרי' },
  { num: '5',  addr: 'מול הקאנטרי',                        geocodeAddr: 'הקאנטרי',             hood: 'קאנטרי' },
  { num: '6',  addr: 'טרומפלדור 21',                      geocodeAddr: 'טרומפלדור 21',        hood: '' },
  { num: '7',  addr: 'העבודה 8',                           geocodeAddr: 'העבודה 8',            hood: 'נווה רמז' },
  { num: '8',  addr: 'סמטת השואבה',                        geocodeAddr: 'סמטת השואבה',         hood: 'נווה שרת' },
  { num: '9',  addr: 'כנפי נשרים פינת גאולים',            geocodeAddr: 'כנפי נשרים',          hood: '' },
  { num: '10', addr: 'שבי ציון 56',                        geocodeAddr: 'שבי ציון 56',         hood: 'שביל ישראל' },
  { num: '11', addr: 'גאולים פינת שבי ציון',              geocodeAddr: 'גאולים',              hood: '' },
  { num: '12', addr: 'המייסדים 100',                       geocodeAddr: 'המייסדים 100',        hood: 'וילות בחורש' },
  { num: '13', addr: 'שדרות נילי 63 - בית ספר ניל"י',     geocodeAddr: 'נילי 63',             hood: 'מושבה' },
  // Approved protected spaces
  { num: '14', addr: 'מבנה המועצה המקומית',               geocodeAddr: 'מועצה מקומית זכרון יעקב', hood: '' },
  { num: '15', addr: 'השקד 14',                            geocodeAddr: 'השקד 14',             hood: '' },
  { num: '16', addr: 'קניון פסגת זכרון',                   geocodeAddr: 'קניון פסגת זכרון',    hood: '' },
];

function inZichronBounds(lat, lon) {
  return lat >= 32.55 && lat <= 32.59 && lon >= 34.93 && lon <= 34.97;
}

function geocode(address) {
  const query = `${address}, זכרון יעקב, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results.length > 0) {
            const loc = result.results[0].geometry.location;
            resolve({ lat: loc.lat, lon: loc.lng, addressEn: result.results[0].formatted_address || '' });
          } else if (result.status === 'OVER_QUERY_LIMIT') {
            reject(new Error('RATE_LIMITED'));
          } else { resolve(null); }
        } catch (e) { reject(new Error('PARSE_ERROR')); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocodeWithRetry(address, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await geocode(address); }
    catch (e) {
      if (e.message === 'RATE_LIMITED' || e.message === 'PARSE_ERROR') {
        await sleep(2000 * (attempt + 1));
      } else throw e;
    }
  }
  return null;
}

async function main() {
  if (!GOOGLE_API_KEY) { console.error('ERROR: No Google API key.'); process.exit(1); }

  console.log(`Geocoding ${RAW_DATA.length} shelters in זכרון יעקב...`);
  const shelters = [], failures = [], outOfBounds = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.geocodeAddr);
    if (!coords) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if (!inZichronBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OUT OF BOUNDS: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    } else {
      shelters.push({
        id: `זכרון-יעקב-${shelters.length + 1}`,
        lat: coords.lat, lon: coords.lon,
        name: `מקלט ${e.num}`, address: e.addr, city: 'זכרון יעקב',
        neighborhood: e.hood,
        type: 'מקלט ציבורי', source: 'gov', category: 'public',
        addressEn: coords.addressEn || '',
      });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }
    await sleep(200);
  }

  const dataPath = path.join(__dirname, '..', 'data', 'zichron-yaakov-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${dataPath}`);
  console.log(`\n=== STATS ===`);
  console.log(`Total: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${outOfBounds.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.addr}`));
  if (outOfBounds.length) outOfBounds.forEach(o => console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
