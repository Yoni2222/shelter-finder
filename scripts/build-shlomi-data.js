'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// Data extracted from Shlomi municipality PDF:
// https://www.shelomi.org.il/uploads/n/1750342182.9092.pdf
const RAW_DATA = [
  { num: '1',  name: 'יפה נוף 178' },
  { num: '2',  name: 'יפה נוף 242' },
  { num: '3',  name: 'ליד מקווה נשים' },
  { num: '4',  name: 'בן גוריון צמוד לצומת' },
  { num: '5',  name: 'ששת הימים 1003, 1005' },
  { num: '6',  name: 'הרב מימון על הכביש' },
  { num: '7',  name: 'ששת הימים 6001 - מאחורי הבלוק' },
  { num: '8',  name: 'נתן אלבז קרוב למרכז הגיל הרך' },
  { num: '9',  name: 'נתן אלבז צמוד לבית הכנסת הגדולה' },
  { num: '10', name: 'אלי לוי - מאחור (דדו 287)' },
  { num: '11', name: 'רחוב הרב חזן ממול למרכז המסחרי הישן' },
  { num: '12', name: 'מרכז שלומי הישן צמוד לדואר ולבית המרקחת' },
  { num: '13', name: 'נתן אלבז 251' },
  { num: '14', name: 'בית הספר בן צבי' },
  { num: '15', name: 'הרב מימון מול בית חב"ד' },
  { num: '16', name: 'רחוב הרב מימון' },
  { num: '17', name: 'מאחורי המקלט של טיפת חלב' },
  { num: '18', name: 'מרכז הגיל הרך - מאחור' },
  { num: '19', name: 'בית הספר בן צבי' },
  { num: '20', name: 'מועצה דתית - צמוד' },
  { num: '21', name: 'בית הספר בן צבי' },
  { num: '22', name: 'גן ש"ס' },
  { num: '23', name: 'בן גוריון צמוד לבלוק 248' },
  { num: '24', name: 'הרב חזן מול האופיס' },
  { num: '25', name: 'גן אירוסים סחלב ברחוב הרב מימון' },
  { num: '26', name: 'הרב חזן מול הכולל' },
  { num: '27', name: 'פינת הרב חזן / הרב עוזיאל' },
  { num: '28', name: 'הרב חזן - מול בית הכנסת המרכזי' },
  { num: '29', name: 'הרב חזן 4' },
  { num: '30', name: 'בית הספר הרב מימון' },
  { num: '31', name: 'בית הספר מחוננים' },
  { num: '32', name: 'בית הספר הרב מימון' },
  { num: '33', name: 'בית הספר הרב מימון' },
  { num: '34', name: 'הרב מימון - מאחורי מחסני חירום' },
  { num: '35', name: 'הרב עוזיאל אחרי קופת החולים כללית' },
  { num: '36', name: 'ז\'בוטינסקי ליד בית הכנסת מול יפה התופרת' },
  { num: '37', name: 'חצר הבית של משה גמירה' },
  { num: '38', name: 'מתנ"ס שלומי' },
  { num: '39', name: 'שירות פסיכולוגי' },
  { num: '40', name: 'אזור התעשייה' },
  { num: '41', name: 'אזור התעשייה' },
  { num: '42', name: 'אזור התעשייה' },
  { num: '43', name: 'אזור התעשייה' },
  { num: '44', name: 'אזור התעשייה' },
  { num: '45', name: 'כפר' },
  { num: '46', name: 'אזור התעשייה' },
  { num: '47', name: 'אזור התעשייה' },
  { num: '48', name: 'אזור התעשייה' },
  { num: '49', name: 'בי"ס בן צבי' },
  { num: '50', name: 'בית הכנסת המרכזי (מחסה)' },
  { num: '51', name: 'אזור התעשייה' },
  { num: '52', name: 'בית ספר הרב מימון' },
  { num: '53', name: 'מעון נוף ילדותי' },
  { num: '54', name: 'מרפאת שיניים כללית' },
  { num: '55', name: 'רחוב בן גוריון - גן ש"ס' },
  { num: '56', name: 'בית ספר הרב מימון' },
  { num: '57', name: 'בן-גוריון מרכז גיל הזהב' },
  { num: '58', name: 'גן סלעית / דוכיפת' },
  { num: '59', name: 'גן נווה רבין' },
  { num: '60', name: 'גן נווה רבין' },
];

// School keywords for category detection
const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'בי"ס', 'חטיבת', 'חטיבה'];

function isSchool(name) {
  return SCHOOL_KEYWORDS.some(kw => name.includes(kw));
}

// Shlomi bounding box (approximate)
function inBounds(lat, lon) { return lat >= 32.99 && lat <= 33.10 && lon >= 35.12 && lon <= 35.20; }

function geocode(address) {
  const query = `${address}, שלומי, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

// Build a geocodable address from the shelter name
function buildAddress(entry) {
  const name = entry.name;
  // Try to extract a street name + number pattern
  // Many entries are descriptive (e.g. "מאחורי המקלט...") - use name as-is for geocoding
  return name;
}

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in שלומי...`);
  const shelters = [], failures = [], oob = [];
  for (let i = 0; i < RAW_DATA.length; i++) {
    const e = RAW_DATA[i];
    const addr = buildAddress(e);
    const c = await geocodeRetry(addr);
    if (!c) {
      failures.push(e);
      console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.name}`);
    } else if (!inBounds(c.lat, c.lon)) {
      oob.push({ ...e, ...c });
      console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.name} -> (${c.lat}, ${c.lon})`);
    } else {
      const category = isSchool(e.name) ? 'school' : 'public';
      shelters.push({
        id: `שלומי-${shelters.length + 1}`,
        lat: c.lat,
        lon: c.lon,
        name: `מקלט ${e.num}`,
        address: e.name,
        city: 'שלומי',
        type: 'מקלט ציבורי',
        source: 'gov',
        category,
        addressEn: c.addressEn || ''
      });
      console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.name} -> (${c.lat}, ${c.lon}) [${category}]`);
    }
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    const category = isSchool(o.name) ? 'school' : 'public';
    shelters.push({
      id: `שלומי-${shelters.length + 1}`,
      lat: o.lat,
      lon: o.lon,
      name: `מקלט ${o.num}`,
      address: o.name,
      city: 'שלומי',
      type: 'מקלט ציבורי',
      source: 'gov',
      category,
      addressEn: o.addressEn || ''
    });
  }
  const p = path.join(__dirname, '..', 'data', 'shlomi-shelters.json');
  fs.writeFileSync(p, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if (failures.length) failures.forEach(f => console.log(`  FAIL: ${f.name}`));
}
main().catch(e => { console.error(e.message); process.exit(1); });
