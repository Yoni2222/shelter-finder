'use strict';
/**
 * Build Nof HaGalil (נוף הגליל) shelters data.
 * Source: Municipality website - 59 public shelters.
 * Run: node scripts/build-nof-hagalil-data.js
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

// Using "כתובת הנוכחית" (current address) column
const RAW_DATA = [
  { num: '01', addr: 'הגיא 8',                            geocodeAddr: 'הגיא 8' },
  { num: '02', addr: 'קישון 8ב',                          geocodeAddr: 'קישון 8' },
  { num: '03', addr: 'מנחם אריאב 48',                     geocodeAddr: 'מנחם אריאב 48' },
  { num: '04', addr: 'מנחם אריאב 56',                     geocodeAddr: 'מנחם אריאב 56' },
  { num: '05', addr: 'מנחם אריאב 44',                     geocodeAddr: 'מנחם אריאב 44' },
  { num: '06', addr: 'מנחם אריאב 38',                     geocodeAddr: 'מנחם אריאב 38' },
  { num: '07', addr: 'שומרון 3',                           geocodeAddr: 'שומרון 3' },
  { num: '08', addr: 'מנחם אריאב 30',                     geocodeAddr: 'מנחם אריאב 30' },
  { num: '09', addr: 'שומרון 8',                           geocodeAddr: 'שומרון 8' },
  { num: '10', addr: 'עצמון 16',                           geocodeAddr: 'עצמון 16' },
  { num: '11', addr: 'מירון 8',                            geocodeAddr: 'מירון 8' },
  { num: '12', addr: 'ארבל 4',                             geocodeAddr: 'ארבל 4' },
  { num: '13', addr: 'ארבל 12',                            geocodeAddr: 'ארבל 12' },
  { num: '14', addr: 'גולן 9',                             geocodeAddr: 'גולן 9' },
  { num: '15', addr: 'גולן 5',                             geocodeAddr: 'גולן 5' },
  { num: '16', addr: 'ארבל 20',                            geocodeAddr: 'ארבל 20' },
  { num: '17', addr: 'ארבל 5',                             geocodeAddr: 'ארבל 5' },
  { num: '18', addr: 'יודפת 23',                           geocodeAddr: 'יודפת 23' },
  { num: '19', addr: 'ציפורי 3',                           geocodeAddr: 'ציפורי 3' },
  { num: '20', addr: 'חרמון 1',                            geocodeAddr: 'חרמון 1' },
  { num: '21', addr: 'חרמון 1',                            geocodeAddr: 'חרמון 1' },
  { num: '22', addr: 'איריס 7',                            geocodeAddr: 'איריס 7' },
  { num: '23', addr: 'כרמל 4',                             geocodeAddr: 'כרמל 4' },
  { num: '24', addr: 'חרמון 7',                            geocodeAddr: 'חרמון 7' },
  { num: '25', addr: 'חרמון 25',                           geocodeAddr: 'חרמון 25' },
  { num: '26', addr: 'נרקיסים 8',                          geocodeAddr: 'נרקיסים 8' },
  { num: '27', addr: 'נרקיסים 4',                          geocodeAddr: 'נרקיסים 4' },
  { num: '28', addr: 'בית ספר חרמון 4',                    geocodeAddr: 'חרמון 4' },
  { num: '29', addr: 'מנחם אריאב 7',                      geocodeAddr: 'מנחם אריאב 7' },
  { num: '30', addr: 'רימון 11',                           geocodeAddr: 'רימון 11' },
  { num: '31', addr: 'בניין העירייה',                      geocodeAddr: 'עיריית נוף הגליל' },
  { num: '32', addr: 'אדמון 38',                           geocodeAddr: 'אדמון 38' },
  { num: '33', addr: 'ורדים 36',                           geocodeAddr: 'ורדים 36' },
  { num: '34', addr: 'ורדים 63',                           geocodeAddr: 'ורדים 63' },
  { num: '35', addr: 'ורדים 92',                           geocodeAddr: 'ורדים 92' },
  { num: '36', addr: 'חבצלת 13',                           geocodeAddr: 'חבצלת 13' },
  { num: '37', addr: 'חבצלת 18',                           geocodeAddr: 'חבצלת 18' },
  { num: '38', addr: 'יסמין 12',                           geocodeAddr: 'יסמין 12' },
  { num: '39', addr: 'יסמין 17',                           geocodeAddr: 'יסמין 17' },
  { num: '40', addr: 'יסמין 1',                            geocodeAddr: 'יסמין 1' },
  { num: '41', addr: 'יסמין 22',                           geocodeAddr: 'יסמין 22' },
  { num: '42', addr: 'יסמין 9',                            geocodeAddr: 'יסמין 9' },
  { num: '43', addr: 'לילך 2',                             geocodeAddr: 'לילך 2' },
  { num: '44', addr: 'מורן 10',                            geocodeAddr: 'מורן 10' },
  { num: '45', addr: 'נורית 11',                           geocodeAddr: 'נורית 11' },
  { num: '46', addr: 'נורית 15',                           geocodeAddr: 'נורית 15' },
  { num: '47', addr: 'נורית 3',                            geocodeAddr: 'נורית 3' },
  { num: '48', addr: 'ניצן 19',                            geocodeAddr: 'ניצן 19' },
  { num: '49', addr: 'ניצן 35',                            geocodeAddr: 'ניצן 35' },
  { num: '50', addr: 'סביון 21',                           geocodeAddr: 'סביון 21' },
  { num: '51', addr: 'סביון 9',                            geocodeAddr: 'סביון 9' },
  { num: '52', addr: 'סיוון 3',                            geocodeAddr: 'סיוון 3' },
  { num: '53', addr: 'סיתוונית 18',                        geocodeAddr: 'סיתוונית 18' },
  { num: '54', addr: 'סיתוונית 4',                         geocodeAddr: 'סיתוונית 4' },
  { num: '55', addr: 'סיתוונית 5',                         geocodeAddr: 'סיתוונית 5' },
  { num: '56', addr: 'עד-עד 36',                           geocodeAddr: 'עדעד 36' },
  { num: '57', addr: 'עדעד 9',                             geocodeAddr: 'עדעד 9' },
  { num: '58', addr: 'צבעוני 12',                          geocodeAddr: 'צבעוני 12' },
  { num: '59', addr: 'צבעוני 2',                           geocodeAddr: 'צבעוני 2' },
];

function inNofHaGalilBounds(lat, lon) {
  return lat >= 32.68 && lat <= 32.73 && lon >= 35.28 && lon <= 35.34;
}

function geocode(address) {
  const query = `${address}, נוף הגליל, ישראל`;
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

  console.log(`Geocoding ${RAW_DATA.length} shelters in נוף הגליל...`);
  const shelters = [], failures = [], outOfBounds = [];

  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.geocodeAddr);
    if (!coords) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);
    } else if (!inNofHaGalilBounds(coords.lat, coords.lon)) {
      outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OUT OF BOUNDS: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    } else {
      shelters.push({
        id: `נוף-הגליל-${shelters.length + 1}`,
        lat: coords.lat, lon: coords.lon,
        name: `מקלט ${e.num}`, address: e.addr, city: 'נוף הגליל',
        type: 'מקלט ציבורי', source: 'gov', category: 'public',
        addressEn: coords.addressEn || '',
      });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }
    await sleep(200);
  }

  const dataPath = path.join(__dirname, '..', 'data', 'nof-hagalil-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${dataPath}`);
  console.log(`\n=== STATS ===`);
  console.log(`Total: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${outOfBounds.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.addr}`));
  if (outOfBounds.length) outOfBounds.forEach(o => console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}

main().catch(e => { console.error(e.message); process.exit(1); });
