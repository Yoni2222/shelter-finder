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
  { num: '1',  addr: 'הראשונים',                    geocodeAddr: 'הראשונים',               hood: 'גבעת עדה' },
  { num: '2',  addr: 'ח"י',                          geocodeAddr: 'חי',                     hood: 'גבעת עדה' },
  { num: '3',  addr: 'האלון',                        geocodeAddr: 'האלון',                  hood: 'גבעת עדה' },
  { num: '4',  addr: 'האלון',                        geocodeAddr: 'האלון',                  hood: 'גבעת עדה' },
  { num: '5',  addr: 'האגס',                         geocodeAddr: 'האגס',                   hood: 'גבעת עדה' },
  { num: '6',  addr: 'תאנה',                         geocodeAddr: 'התאנה',                  hood: 'גבעת עדה' },
  { num: '7',  addr: 'גפן',                          geocodeAddr: 'הגפן',                   hood: 'גבעת עדה' },
  { num: '8',  addr: 'סמטת החצב',                    geocodeAddr: 'סמטת החצב',              hood: 'גבעת עדה' },
  { num: '9',  addr: 'הרימון',                       geocodeAddr: 'הרימון',                 hood: 'גבעת עדה' },
  { num: '10', addr: 'הרימון',                       geocodeAddr: 'הרימון',                 hood: 'גבעת עדה' },
  { num: '11', addr: 'אורנים',                       geocodeAddr: 'אורנים',                 hood: 'גבעת עדה' },
  { num: '12', addr: 'הארזים',                       geocodeAddr: 'הארזים',                 hood: 'גבעת עדה' },
  { num: '13', addr: 'רקפת',                         geocodeAddr: 'רקפת',                   hood: 'בנימינה' },
  { num: '14', addr: 'סמדר',                         geocodeAddr: 'סמדר',                   hood: 'בנימינה' },
  { num: '15', addr: 'עבודה',                        geocodeAddr: 'העבודה',                 hood: 'בנימינה' },
  { num: '16', addr: 'העצמאות',                      geocodeAddr: 'העצמאות',                hood: 'בנימינה' },
  { num: '17', addr: 'הבושם',                        geocodeAddr: 'הבושם',                  hood: 'בנימינה' },
  { num: '18', addr: 'האיכר',                        geocodeAddr: 'האיכר',                  hood: 'בנימינה' },
  { num: '19', addr: 'המייסדים פינת הכרמל',          geocodeAddr: 'המייסדים',               hood: 'בנימינה' },
  { num: '20', addr: 'הנדיב',                        geocodeAddr: 'הנדיב',                  hood: 'בנימינה' },
  { num: '21', addr: 'דקל',                          geocodeAddr: 'דקל',                    hood: 'גבעת עדה' },
  { num: '22', addr: 'בית ספר אשכולות',              geocodeAddr: 'בית ספר אשכולות',        hood: 'בנימינה' },
  { num: '23', addr: 'בית ספר הנדיב',                geocodeAddr: 'בית ספר הנדיב',          hood: 'בנימינה' },
  { num: '24', addr: 'בית ספר אמירים',               geocodeAddr: 'בית ספר אמירים',         hood: 'בנימינה' },
  { num: '25', addr: 'בית ספר כרמים',                geocodeAddr: 'בית ספר כרמים בנימינה',  hood: 'בנימינה' },
  { num: '26', addr: 'מרכז הפעלה',                   geocodeAddr: 'מרכז הפעלה',             hood: 'בנימינה' },
  { num: '27', addr: 'בית ספר גבע',                  geocodeAddr: 'בית ספר גבע גבעת עדה',  hood: 'גבעת עדה' },
];

function inBounds(lat, lon) {
  return lat >= 32.50 && lat <= 32.55 && lon >= 34.92 && lon <= 34.97;
}

function geocode(address) {
  const query = `${address}, בנימינה-גבעת עדה, ישראל`;
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
  console.log(`Geocoding ${RAW_DATA.length} shelters in בנימינה-גבעת עדה...`);
  const shelters = [], failures = [], outOfBounds = [];
  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const coords = await geocodeWithRetry(e.geocodeAddr);
    if (!coords) { failures.push(e); console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`); }
    else if (!inBounds(coords.lat, coords.lon)) { outOfBounds.push({ ...e, lat: coords.lat, lon: coords.lon }); console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${coords.lat}, ${coords.lon})`); }
    else {
      const cat = e.addr.startsWith('בית ספר') ? 'school' : 'public';
      shelters.push({ id: `בנימינה-${shelters.length + 1}`, lat: coords.lat, lon: coords.lon, name: `מקלט ${e.num}`, address: e.addr, city: 'בנימינה-גבעת עדה', neighborhood: e.hood, type: 'מקלט ציבורי', source: 'gov', category: cat, addressEn: coords.addressEn || '' });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${coords.lat}, ${coords.lon})`);
    }
    await sleep(200);
  }
  const dataPath = path.join(__dirname, '..', 'data', 'binyamina-shelters.json');
  fs.writeFileSync(dataPath, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${dataPath}\n=== STATS ===\nTotal: ${RAW_DATA.length}, OK: ${shelters.length}, Failed: ${failures.length}, OOB: ${outOfBounds.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.addr}`));
  if (outOfBounds.length) outOfBounds.forEach(o => console.log(`  OOB: ${o.addr} -> (${o.lat}, ${o.lon})`));
}
main().catch(e => { console.error(e.message); process.exit(1); });
