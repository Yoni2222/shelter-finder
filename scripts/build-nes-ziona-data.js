'use strict';
/**
 * Build Nes Ziona (נס ציונה) shelters data.
 * Source: Municipality website - 23 public shelters.
 * Run: node scripts/build-nes-ziona-data.js
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
  { num: '1',  addr: 'שאול המלך 5',                geocodeAddr: 'שאול המלך 5' },
  { num: '2',  addr: 'שבטי ישראל 16',              geocodeAddr: 'שבטי ישראל 16' },
  { num: '3',  addr: 'רחבעם זאבי 19',              geocodeAddr: 'רחבעם זאבי 19' },
  { num: '4',  addr: 'תחנת ויצמן',                 geocodeAddr: 'ויצמן' },
  { num: '5',  addr: 'מועדון נוער אפרים 23',       geocodeAddr: 'אפרים 23' },
  { num: '6',  addr: 'העצמאות 10',                  geocodeAddr: 'העצמאות 10' },
  { num: '7',  addr: 'כצנלסון/הדרים 11',           geocodeAddr: 'כצנלסון 11' },
  { num: '8',  addr: 'ששת הימים/משה סנה 1',        geocodeAddr: 'ששת הימים' },
  { num: '9',  addr: 'ניר גן נורדאו 53',           geocodeAddr: 'נורדאו 53' },
  { num: '10', addr: 'הבנים 99',                    geocodeAddr: 'הבנים 99' },
  { num: '11', addr: 'נילי 7',                      geocodeAddr: 'נילי 7' },
  { num: '12', addr: 'הבנים 45',                    geocodeAddr: 'הבנים 45' },
  { num: '13', addr: 'הבנים/יצחק שדה 15',          geocodeAddr: 'יצחק שדה 15' },
  { num: '14', addr: 'תל אביב 17',                 geocodeAddr: 'תל אביב 17' },
  { num: '15', addr: 'צה"ל 15',                     geocodeAddr: 'צהל 15' },
  { num: '16', addr: 'יצחק שדה 21',                geocodeAddr: 'יצחק שדה 21' },
  { num: '17', addr: 'יציאת אירופה 15',            geocodeAddr: 'יציאת אירופה 15' },
  { num: '18', addr: 'בן גוריון 6',                geocodeAddr: 'בן גוריון 6' },
  { num: '19', addr: 'לוחמי הגטאות 29',            geocodeAddr: 'לוחמי הגטאות 29' },
  { num: '20', addr: 'משה סנה 7',                  geocodeAddr: 'משה סנה 7' },
  { num: '21', addr: 'אלי כהן 5',                  geocodeAddr: 'אלי כהן 5' },
  { num: '22', addr: 'תרת שלום אבנר בן יהודה 4',  geocodeAddr: 'אבנר בן יהודה 4' },
  { num: '23', addr: 'ביאליק 34',                  geocodeAddr: 'ביאליק 34' },
];

function inNesZionaBounds(lat, lon) {
  return lat >= 31.91 && lat <= 31.95 && lon >= 34.78 && lon <= 34.82;
}

function geocode(address) {
  const query = `${address}, נס ציונה, ישראל`;
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

  console.log(`Geocoding ${RAW_DATA.length} shelters in נס ציונה...`);
  const shelters = [], failures = [], outOfBounds = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.geocodeAddr);
    if (!coords) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if (!inNesZionaBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OUT OF BOUNDS: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    } else {
      shelters.push({
        id: `נס-ציונה-${shelters.length + 1}`,
        lat: coords.lat, lon: coords.lon,
        name: `מקלט ${e.num}`, address: e.addr, city: 'נס ציונה',
        type: 'מקלט ציבורי', source: 'gov', category: 'public',
        addressEn: coords.addressEn || '',
      });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }
    await sleep(200);
  }

  const dataPath = path.join(__dirname, '..', 'data', 'nes-ziona-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${dataPath}`);
  console.log(`\n=== STATS ===`);
  console.log(`Total: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${outOfBounds.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.addr}`));
  if (outOfBounds.length) outOfBounds.forEach(o => console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
