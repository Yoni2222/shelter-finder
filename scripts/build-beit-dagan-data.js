'use strict';
const fs = require('fs'), path = require('path');
const https = require('https');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || (() => { try { const e = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); const m = e.match(/GOOGLE_MAPS_API_KEY=(.+)/); return m ? m[1].trim() : ''; } catch { return ''; } })();

const CITY = 'בית דגן';

const RAW_DATA = [
  { num:'1',  addr:'כצנלסון 25',      note:'ליד היציאה של הכלביה' },
  { num:'2',  addr:'כצנלסון 56',      note:'' },
  { num:'3',  addr:'הגולן 3',         note:'פינת היובל' },
  { num:'4',  addr:'קפלן 19',         note:'פינת הנגב' },
  { num:'5',  addr:'הבנים 25',        note:'צומת התפוז' },
  { num:'6',  addr:'מנחם בגין 50',    note:'בית כנסת חב"ד' },
  { num:'7',  addr:'מנחם בגין 80',    note:'' },
  { num:'8',  addr:'טרומפלדור 8',     note:'' },
  { num:'9',  addr:'ארבעת המינים',    note:'' },
  { num:'10', addr:'ז\'בוטינסקי 8',   note:'' },
  { num:'11', addr:'ז\'בוטינסקי 25',  note:'מול בית ברן' },
];

// School keywords for category detection
const SCHOOL_KEYWORDS = ['בית ספר', 'בית הספר', 'ביה"ס', 'חטיבת', 'חטיבה', 'תיכון'];

function getCategory(name, addr, note) {
  const text = `${name} ${addr} ${note}`.toLowerCase();
  for (const kw of SCHOOL_KEYWORDS) {
    if (text.includes(kw)) return 'school';
  }
  return 'public';
}

// Beit Dagan bounding box (roughly)
function inBounds(lat, lon) { return lat >= 31.99 && lat <= 32.03 && lon >= 34.80 && lon <= 34.84; }

function geocode(address) {
  const query = `${address}, ${CITY}, ישראל`;
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
    const name = e.note ? `מקלט ${e.num} (${e.note})` : `מקלט ${e.num}`;
    const category = getCategory(name, e.addr, e.note);
    if(!c){failures.push(e);console.warn(`  [${i+1}/${RAW_DATA.length}] FAIL: ${e.addr}`);}
    else if(!inBounds(c.lat,c.lon)){oob.push({...e,name,category,...c});console.warn(`  [${i+1}/${RAW_DATA.length}] OOB: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    else{shelters.push({id:`בית-דגן-${shelters.length+1}`,lat:c.lat,lon:c.lon,name,address:e.addr,city:CITY,type:'מקלט ציבורי',source:'gov',category,addressEn:c.addressEn||''});console.log(`  [${i+1}/${RAW_DATA.length}] OK: ${e.addr} -> (${c.lat}, ${c.lon})`);}
    await sleep(200);
  }
  // Add OOB shelters (likely valid - bounding box might be too tight)
  for (const o of oob) {
    shelters.push({id:`בית-דגן-${shelters.length+1}`,lat:o.lat,lon:o.lon,name:o.name,address:o.addr,city:CITY,type:'מקלט ציבורי',source:'gov',category:o.category,addressEn:o.addressEn||''});
  }
  const p=path.join(__dirname,'..','data','beit-dagan-shelters.json');
  fs.writeFileSync(p,JSON.stringify(shelters,null,2),'utf8');
  console.log(`\nSaved ${p}\nTotal: ${RAW_DATA.length}, OK (in bounds): ${shelters.length - oob.length}, OOB (included): ${oob.length}, Failed: ${failures.length}`);
  if(failures.length)failures.forEach(f=>console.log(`  FAIL: ${f.addr}`));
}
main().catch(e=>{console.error(e.message);process.exit(1)});
