'use strict';
/**
 * Build Yokneam (יקנעם) shelters data.
 * Source: Municipality PDF - 35 public shelters.
 * Run: node scripts/build-yokneam-data.js
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

// Decoded from reversed-Hebrew PDF
const RAW_DATA = [
  { num: '1',  addr: 'התאנה 2',               geocodeAddr: 'התאנה 2' },
  { num: '2',  addr: 'התאנה 6',               geocodeAddr: 'התאנה 6' },
  { num: '3',  addr: 'התאנה 10',              geocodeAddr: 'התאנה 10' },
  { num: '4',  addr: 'התאנה 14',              geocodeAddr: 'התאנה 14' },
  { num: '5',  addr: 'התמר 3',               geocodeAddr: 'התמר 3' },
  { num: '6',  addr: 'השיטה 3',              geocodeAddr: 'השיטה 3' },
  { num: '7',  addr: 'השיטה 8',              geocodeAddr: 'השיטה 8' },
  { num: '8',  addr: 'יפה נוף',              geocodeAddr: 'יפה נוף' },
  { num: '9',  addr: 'הגיבורים 15',          geocodeAddr: 'הגיבורים 15' },
  { num: '10', addr: 'יפה נוף',              geocodeAddr: 'יפה נוף' },
  { num: '11', addr: 'חרצית 17',             geocodeAddr: 'חרצית 17' },
  { num: '12', addr: 'אירוסים',              geocodeAddr: 'אירוסים' },
  { num: '13', addr: 'בי"ס הדסים (תל יקנעם)', geocodeAddr: 'תל יקנעם' },
  { num: '14', addr: 'מרגנית 38',            geocodeAddr: 'מרגנית 38' },
  { num: '15', addr: 'סיגלית 11',            geocodeAddr: 'סיגלית 11' },
  { num: '16', addr: 'מרגנית 8',             geocodeAddr: 'מרגנית 8' },
  { num: '17', addr: 'יסמין 21',             geocodeAddr: 'יסמין 21' },
  { num: '18', addr: 'יסמין 38',             geocodeAddr: 'יסמין 38' },
  { num: '19', addr: 'כלנית',                geocodeAddr: 'כלנית' },
  { num: '20', addr: 'כלנית 14',             geocodeAddr: 'כלנית 14' },
  { num: '21', addr: 'לילך 1',               geocodeAddr: 'לילך 1' },
  { num: '22', addr: 'נרקיסים 6',            geocodeAddr: 'נרקיסים 6' },
  { num: '23', addr: 'חרצית 8',              geocodeAddr: 'חרצית 8' },
  { num: '24', addr: 'המלאכה 4',             geocodeAddr: 'המלאכה 4' },
  { num: '25', addr: 'אזור תעשיה 7',        geocodeAddr: 'אזור תעשיה' },
  { num: '26', addr: 'התעשייה',              geocodeAddr: 'התעשייה' },
  { num: '27', addr: 'התעשייה 7',            geocodeAddr: 'התעשייה 7' },
  { num: '35', addr: 'פעמונית',              geocodeAddr: 'פעמונית' },
  { num: '36', addr: 'פעמונית',              geocodeAddr: 'פעמונית' },
  { num: '37', addr: 'פעמונית',              geocodeAddr: 'פעמונית' },
  { num: '38', addr: 'מתנ"ס אלונים 45',     geocodeAddr: 'אלונים 45' },
  { num: '48', addr: 'מרכז מסחרי מול סופר יש', geocodeAddr: 'מרכז מסחרי' },
  { num: '49', addr: 'מרכז מסחרי',           geocodeAddr: 'מרכז מסחרי' },
  { num: '61', addr: 'צאלים 21',             geocodeAddr: 'צאלים 21' },
  { num: '64', addr: 'צאלים 27',             geocodeAddr: 'צאלים 27' },
];

function inYokneamBounds(lat, lon) {
  return lat >= 32.63 && lat <= 32.68 && lon >= 35.07 && lon <= 35.13;
}

function geocode(address) {
  const query = `${address}, יקנעם עילית, ישראל`;
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

  console.log(`Geocoding ${RAW_DATA.length} shelters in יקנעם...`);
  const shelters = [], failures = [], outOfBounds = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.geocodeAddr);
    if (!coords) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if (!inYokneamBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OUT OF BOUNDS: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    } else {
      shelters.push({
        id: `יקנעם-${shelters.length + 1}`,
        lat: coords.lat, lon: coords.lon,
        name: `מקלט ${e.num}`, address: e.addr, city: 'יקנעם עילית',
        type: 'מקלט ציבורי', source: 'gov', category: 'public',
        addressEn: coords.addressEn || '',
      });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }
    await sleep(200);
  }

  const dataPath = path.join(__dirname, '..', 'data', 'yokneam-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${dataPath}`);
  console.log(`\n=== STATS ===`);
  console.log(`Total: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${outOfBounds.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.addr}`));
  if (outOfBounds.length) outOfBounds.forEach(o => console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
