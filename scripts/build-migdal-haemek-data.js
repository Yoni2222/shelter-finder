'use strict';
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
  { num: '3',   addr: 'דובדבן 3',                     hood: 'עילי' },
  { num: '4',   addr: 'צבר 4',                        hood: 'עילי' },
  { num: '5',   addr: 'צבר 22',                       hood: 'עילי' },
  { num: '6',   addr: 'חרוב 7',                       hood: 'עילי' },
  { num: '7',   addr: 'חרוב 12',                      hood: 'עילי' },
  { num: '8',   addr: 'דובדבן 12',                    hood: 'עילי' },
  { num: '9',   addr: 'השקד 9',                       hood: 'עילי' },
  { num: '10',  addr: 'הצורן',                        hood: 'תחתי' },
  { num: '11',  addr: 'הנפח',                         hood: 'תחתי' },
  { num: '12',  addr: 'הצורף',                        hood: 'תחתי' },
  { num: '13',  addr: 'הצורף',                        hood: 'תחתי' },
  { num: '14',  addr: 'הנגר',                         hood: 'תחתי' },
  { num: '16',  addr: 'השיש',                         hood: 'תחתי' },
  { num: '17',  addr: 'הצורן',                        hood: 'תחתי' },
  { num: '18',  addr: 'חטיבת גולני 26',               hood: 'תחתי' },
  { num: '19',  addr: 'חטיבת גולני 28',               hood: 'תחתי' },
  { num: '23',  addr: 'הברושים 3',                    hood: 'תחתי' },
  { num: '24',  addr: 'האלונים 10',                   hood: 'תחתי' },
  { num: '25',  addr: 'חטיבת גולני 19',               hood: 'תחתי' },
  { num: '25a', addr: 'חטיבת גולני 19',               hood: 'תחתי' },
  { num: '26',  addr: 'משעול ההדרים 3',               hood: 'תחתי' },
  { num: '27',  addr: 'מירון 27',                     hood: 'תחתי' },
  { num: '28',  addr: 'הנשיאים 17',                   hood: 'תחתי' },
  { num: '29',  addr: 'חטיבת גולני 13',               hood: 'תחתי' },
  { num: '30',  addr: 'חטיבת גולני 12',               hood: 'תחתי' },
  { num: '31',  addr: 'משעול הדקלים 1',               hood: 'תחתי' },
  { num: '33',  addr: 'עצמון 23',                     hood: 'תחתי' },
  { num: '35',  addr: 'צבי אלדרוטי 12',              hood: 'תחתי' },
  { num: '36',  addr: 'צבי אלדרוטי 1',               hood: 'תחתי' },
  { num: '40',  addr: 'תדהר 10',                      hood: 'עילי' },
  { num: '41',  addr: 'נופר 8',                       hood: 'עילי' },
  { num: '47',  addr: 'חימר 2',                       hood: 'עילי' },
  { num: '48',  addr: 'שיקמה 1',                      hood: 'עילי' },
  { num: '49',  addr: 'שיקמה 4',                      hood: 'עילי' },
  { num: '50',  addr: 'שקמה 7',                       hood: 'עילי' },
  { num: '51',  addr: 'כליל החורש 10',                hood: 'עילי' },
  { num: '52',  addr: 'ערבה 16',                      hood: 'עילי' },
  { num: '53',  addr: 'כליל החורש 9',                 hood: 'עילי' },
  { num: '54',  addr: 'העצמאות 75',                   hood: 'תחתי' },
  { num: '55',  addr: 'חימר 12',                      hood: 'תחתי' },
  { num: '56',  addr: 'משעול זמיר 9',                 hood: 'תחתי' },
  { num: '57',  addr: 'משעול הצבעוני 8',              hood: 'תחתי' },
  { num: '58',  addr: 'זבולון 9',                     hood: 'תחתי' },
  { num: '60',  addr: 'הורד 4',                       hood: 'תחתי' },
  { num: '61',  addr: 'הורד 3',                       hood: 'עילי' },
  { num: '62',  addr: 'הורד 6',                       hood: 'תחתי' },
  { num: '63',  addr: 'גלעד 4',                       hood: 'תחתי' },
  { num: '64',  addr: 'הבשן 9',                       hood: 'תחתי' },
  { num: '67',  addr: 'קדש 39',                       hood: 'תחתי' },
  { num: '68',  addr: 'שלום עליכם 12',                hood: 'תחתי' },
  { num: '69',  addr: 'העצמאות 30',                   hood: 'תחתי' },
  { num: '70',  addr: 'שלום עליכם 8',                 hood: 'תחתי' },
  { num: '78',  addr: 'משעול הצבעוני 9',              hood: 'תחתי' },
  { num: '79',  addr: 'המסגר 1',                      hood: 'תחתי' },
  { num: '80',  addr: 'הנגר 1',                       hood: 'עילי' },
  { num: '87',  addr: 'הצאלון 3',                     hood: 'תחתי' },
  { num: '93',  addr: 'הצורף',                        hood: 'עילי' },
  { num: '95',  addr: 'תשי"ג',                        hood: 'עילי' },
  { num: '96',  addr: 'העצמאות 7',                    hood: 'עילי' },
  { num: '97',  addr: 'הנשיאים',                      hood: 'תחתי' },
  { num: '99',  addr: 'החורש 7',                      hood: 'עילי' },
  { num: '100', addr: 'זבולון 24',                    hood: 'תחתי' },
];

function inBounds(lat, lon) {
  return lat >= 32.66 && lat <= 32.70 && lon >= 35.17 && lon <= 35.24;
}

function geocode(address) {
  const query = `${address}, מגדל העמק, ישראל`;
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
          } else if (result.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED'));
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
    catch (e) { if (e.message === 'RATE_LIMITED' || e.message === 'PARSE_ERROR') { await sleep(2000 * (attempt + 1)); } else throw e; }
  }
  return null;
}

async function main() {
  if (!GOOGLE_API_KEY) { console.error('ERROR: No Google API key.'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in מגדל העמק...`);
  const shelters = [], failures = [], outOfBounds = [];
  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.addr);
    if (!coords) { failures.push(e); console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`); }
    else if (!inBounds(coords.lat, coords.lon)) { outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon }); console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${coords.lat}, ${coords.lon})`); }
    else {
      shelters.push({ id: `מגדל-העמק-${shelters.length + 1}`, lat: coords.lat, lon: coords.lon, name: `מקלט ${e.num}`, address: e.addr, city: 'מגדל העמק', neighborhood: e.hood, type: 'מקלט ציבורי', source: 'gov', category: 'public', addressEn: coords.addressEn || '' });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }
    await sleep(200);
  }
  const dataPath = path.join(__dirname, '..', 'data', 'migdal-haemek-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${dataPath}\n=== STATS ===\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${outOfBounds.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.addr}`));
  if (outOfBounds.length) outOfBounds.forEach(o => console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e => { console.error(e.message); process.exit(1); });
