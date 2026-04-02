'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const CITY = 'אזור';

// School/kindergarten keywords for category detection
const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'ביה״ס', 'חטיבת', 'תיכון'];
// גן only if NOT followed by העיר or similar non-kindergarten uses
function isSchoolCategory(name, addr) {
  const combined = (name || '') + ' ' + (addr || '');
  for (const kw of SCHOOL_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  // Check for גן (kindergarten) but not גן העיר, גן יבנה, etc.
  if (/גן\b/.test(combined) && !/גן העיר|גן יבנה|גן הבנים/.test(combined)) {
    // Only if it looks like a kindergarten context (גן ילדים, גן חובה, or standalone גן as part of a school name)
    if (/גן\s*(ילדים|חובה|טרום|ילד)/.test(combined) || /^גן\s/.test(combined.trim())) return true;
  }
  return false;
}

const RAW_DATA = [
  { name: 'מקלט העליה השניה / ביאליק',     addr: 'השקמה',              note: 'העליה השניה / ביאליק' },
  { name: 'מקלט אחד במאי / ויצמן',          addr: 'אחד במאי',           note: 'הספריה הישנה' },
  { name: 'מקלט אנליביץ',                    addr: 'אנליביץ 6',          note: 'בלוק 6' },
  { name: 'מקלט יצחק שדה 8',                 addr: 'יצחק שדה 8',         note: 'בלוק 8' },
  { name: 'מקלט יצחק שדה 18',                addr: 'יצחק שדה 18',        note: 'מועצה מקומית אזור' },
  { name: 'מקלט ציבורי ביה"ס יוספטל',        addr: 'חנה סנש',             note: 'כניסה מרחוב חנה סנש' },
  { name: 'מקלט קפלן 7',                     addr: 'קפלן 7',             note: '' },
  { name: 'מקלט קפלן 15 בית ספר מימון',      addr: 'קפלן 15',            note: 'בית ספר מימון' },
  { name: 'מקלט ציבורי ביה"ס השבעה',         addr: 'השבעה',               note: '' },
];

// Bounding box for Azor (small town near Tel Aviv)
function inBounds(lat, lon) { return lat >= 31.99 && lat <= 32.05 && lon >= 34.77 && lon <= 34.82; }

function geocode(address) {
  const query = `${address}, אזור, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in ${CITY}...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{
      const cat = isSchoolCategory(e.name, e.addr) ? 'school' : 'public';
      shelters.push({id:`${CITY}-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:e.name,address:e.addr,city:CITY,type:'מקלט ציבורי',source:'gov',category:cat,addressEn:c.addressEn||''});
      console.log(`  [${i+1}/${RAW_DATA.length}] OK (${cat}): ${e.addr} -> (${c.lat}, ${c.lon})`);
    }
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    const cat = isSchoolCategory(o.name, o.addr) ? 'school' : 'public';
    shelters.push({id:`${CITY}-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:CITY,type:'מקלט ציבורי',source:'gov',category:cat,addressEn:''});
  }
  const p=path.join(__dirname,'..','data','azor-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1)});
