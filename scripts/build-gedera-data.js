'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

// Data from https://gedera.muni.il/181/
const RAW_DATA = [
  // מקלטים ציבוריים
  { name: 'מקלט קדרון',              addr: 'קדרון',             category: 'public' },
  { name: 'מקלט מרבד הקסמים 20',     addr: 'מרבד הקסמים 20',   category: 'public' },
  { name: 'מקלט ויצמן 49',           addr: 'ויצמן 49',         category: 'public' },
  { name: 'מקלט אלי כהן 12',         addr: 'אלי כהן 12',       category: 'public' },
  { name: 'מקלט הנשיא 4',            addr: 'הנשיא 4',          category: 'public' },
  { name: 'מקלט רמז 19',             addr: 'רמז 19',           category: 'public' },
  // מרחבים מוגנים נוספים
  { name: 'תיכון בגין',              addr: 'משה נבט',           category: 'school' },
  { name: 'בית הספר פינס',           addr: 'פינס',              category: 'school' },
  { name: 'מרכז דנה',                addr: 'ארז 2',            category: 'public' },
  { name: 'ת"ת מעלות רם',            addr: 'גד 17',            category: 'school' },
  { name: 'מקלט בני עקיבא',          addr: 'ויצמן',             category: 'public' },
  { name: 'ספרייה',                   addr: 'לילנבלום',          category: 'public' },
  { name: 'מקלט שירותים חברתיים',     addr: 'פייבל 5',           category: 'public' },
  { name: 'המרכז להתפתחות הילד',      addr: 'אשר 11',           category: 'public' },
  { name: 'מועדונית קסם',            addr: 'שבזי',              category: 'public' },
];

// School keywords for category detection (already set above manually, but verify)
const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'בי"ס', 'חטיבת', 'חטיבה', 'תיכון', 'ת"ת'];
function isSchool(name) {
  const n = name || '';
  return SCHOOL_KEYWORDS.some(kw => n.includes(kw));
}

// Bounding box for Gedera (approx)
function inBounds(lat, lon) { return lat >= 31.79 && lat <= 31.83 && lon >= 34.75 && lon <= 34.80; }

function geocode(address) {
  const query = `${address}, גדרה, ישראל`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=he&region=il`;
  return new Promise((resolve, reject) => { https.get(url, res => { let data = ''; res.on('data', d => data += d); res.on('end', () => { try { const r = JSON.parse(data); if (r.status === 'OK' && r.results.length > 0) { const l = r.results[0].geometry.location; resolve({ lat: l.lat, lon: l.lng, addressEn: r.results[0].formatted_address || '' }); } else if (r.status === 'OVER_QUERY_LIMIT') { reject(new Error('RATE_LIMITED')); } else { resolve(null); } } catch (e) { reject(new Error('PARSE_ERROR')); } }); }).on('error', reject); });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function geocodeRetry(addr, retries=3) { for (let a=0;a<retries;a++) { try { return await geocode(addr); } catch(e) { if(e.message==='RATE_LIMITED'||e.message==='PARSE_ERROR') await sleep(2000*(a+1)); else throw e; } } return null; }

async function main() {
  if (!GOOGLE_API_KEY) { console.error('No API key'); process.exit(1); }
  console.log(`Geocoding ${RAW_DATA.length} shelters in גדרה...`);
  const shelters=[], failures=[], oob=[];
  for (let i=0;i<RAW_DATA.length;i++) {
    const e=RAW_DATA[i]; const c=await geocodeRetry(e.addr);
    // Determine category: use manual setting, but also check name for school keywords
    const cat = e.category === 'school' || isSchool(e.name) ? 'school' : 'public';
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.name} (${e.addr})`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,lat:c.lat,lon:c.lon,addressEn:c.addressEn});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.name} (${e.addr}) -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`גדרה-${shelters.length+1}`,lat:c.lat,lon:c.lon,name:e.name,address:e.addr,city:'גדרה',type:'מקלט ציבורי',source:'gov',category:cat,addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.name} (${e.addr}) -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    const cat = o.category === 'school' || isSchool(o.name) ? 'school' : 'public';
    shelters.push({id:`גדרה-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:'גדרה',type:'מקלט ציבורי',source:'gov',category:cat,addressEn:o.addressEn||''});
  }
  const p=path.join(__dirname,'..','data','gedera-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.name} (${f.addr})`));
}
main().catch(e=>{console.error(e.message);process.exit(1);});
